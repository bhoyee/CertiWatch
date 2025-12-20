using System.IO;
using CertiWatch.Api.Configuration;
using CertiWatch.Api.Domain.Entities;
using CertiWatch.Api.Features.Auth;
using CertiWatch.Api.Infrastructure.Emails;
using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Infrastructure.Services;
using CertiWatch.Api.Infrastructure.Security;
using CertiWatch.Contracts.Requests;
using CertiWatch.Contracts.Responses;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Stripe;
using Stripe.Checkout;
using PortalSessionService = Stripe.BillingPortal.SessionService;

namespace CertiWatch.Api.Features.Billing;

public static class BillingEndpoints
{
    public static IEndpointRouteBuilder MapBillingEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/billing");
        group.MapPost("/checkout", CreateCheckoutSessionAsync).AllowAnonymous();
        group.MapPost("/webhook", HandleWebhookAsync).AllowAnonymous();
        group.MapPost("/portal", CreatePortalSessionAsync).RequireAuthorization();
        group.MapGet("/invoices", ListInvoicesAsync).RequireAuthorization();
        return routes;
    }

    private static async Task<IResult> CreatePortalSessionAsync(AppDbContext db, ITenantContextAccessor accessor, IOptions<StripeOptions> stripeOptions, CancellationToken token)
    {
        if (!RecordVisibility.IsAdmin(accessor))
        {
            return Results.Forbid();
        }

        var tenantId = accessor.Current.TenantId;
        var tenant = await db.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == tenantId, token);
        if (tenant is null || string.IsNullOrWhiteSpace(tenant.StripeCustomerId))
        {
            return Results.BadRequest(new { error = "no_stripe_customer" });
        }

        var options = stripeOptions.Value;
        var service = new PortalSessionService();
        var session = await service.CreateAsync(new Stripe.BillingPortal.SessionCreateOptions
        {
            Customer = tenant.StripeCustomerId,
            ReturnUrl = options.SuccessUrl
        });

        return Results.Ok(new { url = session.Url });
    }

    private static async Task<IResult> ListInvoicesAsync(AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        if (!RecordVisibility.IsAdmin(accessor))
        {
            return Results.Forbid();
        }

        var tenantId = accessor.Current.TenantId;
        var invoices = await db.BillingInvoices
            .AsNoTracking()
            .Where(i => i.TenantId == tenantId)
            .OrderByDescending(i => i.InvoiceDateUtc ?? i.CreatedAt)
            .Select(i => new
            {
                i.StripeInvoiceId,
                i.AmountDue,
                i.AmountPaid,
                i.Currency,
                i.Status,
                i.HostedInvoiceUrl,
                i.PdfUrl,
                i.InvoiceDateUtc
            })
            .ToListAsync(token);

        return Results.Ok(invoices);
    }

    private static async Task<IResult> CreateCheckoutSessionAsync(
        CreateCheckoutSessionRequest request,
        ITenantContextAccessor accessor,
        AppDbContext db,
        IOptions<StripeOptions> stripeOptions,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        var logger = loggerFactory.CreateLogger("Billing");
        var options = stripeOptions.Value;
        if (accessor.Current.TenantId != Guid.Empty && RecordVisibility.IsViewer(accessor))
        {
            return Results.Forbid();
        }

        var plan = options.Plans.FirstOrDefault(p => string.Equals(p.PlanId, request.PlanId, StringComparison.OrdinalIgnoreCase));
        if (plan is null)
        {
            return Results.BadRequest(new { error = "unknown_plan" });
        }

        // Resolve price details for currency checks.
        var priceService = new PriceService();
        var price = await priceService.GetAsync(plan.PriceId, cancellationToken: cancellationToken);
        var planCurrency = price.Currency ?? "usd";

        // If authenticated, allow missing fields and hydrate from current tenant/user
        var adminEmail = request.AdminEmail?.Trim();
        var adminName = request.AdminName?.Trim();
        var companyName = request.CompanyName?.Trim();

        var ctx = accessor.Current;
        Tenant? tenant = null;
        if (ctx.TenantId != Guid.Empty)
        {
            tenant = await db.Tenants.FirstOrDefaultAsync(t => t.Id == ctx.TenantId, cancellationToken);
            companyName ??= tenant?.Name;
            adminEmail ??= ctx.Email;
            adminName ??= ctx.Email;
        }

        if (string.IsNullOrWhiteSpace(adminEmail))
        {
            return Results.BadRequest(new { error = "missing_admin_email", friendlyError = "Please provide an admin email." });
        }

        adminEmail = adminEmail.Trim();

        if (string.IsNullOrWhiteSpace(companyName))
        {
            companyName = "Tenant";
        }

        if (string.IsNullOrWhiteSpace(adminName))
        {
            adminName = adminEmail;
        }

        var isSignupRequest = !string.IsNullOrWhiteSpace(request.AdminEmail) && !string.IsNullOrWhiteSpace(request.CompanyName);
        if (isSignupRequest)
        {
            var normalizedEmail = adminEmail.ToLowerInvariant();
            var emailExists = await db.Users.AsNoTracking()
                .AnyAsync(u => u.Email.ToLower() == normalizedEmail, cancellationToken);
            if (emailExists)
            {
                return Results.Conflict(new { error = "email_exists", friendlyError = "An account with this email already exists. Please log in." });
            }
        }

        // Avoid reusing existing customers to sidestep currency conflicts; Stripe will create one from CustomerEmail.
        Customer? existingCustomer = null;

        var trialEligible = true;
        if (existingCustomer?.Metadata != null &&
            existingCustomer.Metadata.TryGetValue("trial_used", out var trialUsed) &&
            string.Equals(trialUsed, "true", StringComparison.OrdinalIgnoreCase))
        {
            trialEligible = false;
        }

        var trialDays = trialEligible ? options.TrialDays : 0;

        // Decide which customer to use.
        string? customerId = null;
        if (tenant is not null && !string.IsNullOrWhiteSpace(tenant.StripeCustomerId))
        {
            customerId = tenant.StripeCustomerId;
        }
        else if (tenant is not null)
        {
            // Create a dedicated customer for this tenant.
            var customerService = new CustomerService();
            var created = await customerService.CreateAsync(new CustomerCreateOptions
            {
                Email = adminEmail,
                Name = companyName,
                Metadata = new Dictionary<string, string>
                {
                    ["tenant_id"] = tenant.Id.ToString(),
                    ["company_name"] = companyName
                }
            }, cancellationToken: cancellationToken);
            tenant.StripeCustomerId = created.Id;
            await db.SaveChangesAsync(cancellationToken);
            customerId = created.Id;
        }

        // If the tenant already has a subscription with a different currency, block checkout and ask support.
        if (tenant is not null && !string.IsNullOrWhiteSpace(tenant.StripeSubscriptionId))
        {
            try
            {
                var subService = new SubscriptionService();
                var existing = await subService.GetAsync(tenant.StripeSubscriptionId, cancellationToken: cancellationToken);
                var existingCurrency = existing.Items?.Data?.FirstOrDefault()?.Price?.Currency;
                if (!string.IsNullOrWhiteSpace(existingCurrency) && !string.Equals(existingCurrency, planCurrency, StringComparison.OrdinalIgnoreCase))
                {
                    return Results.BadRequest(new
                    {
                        friendlyError = "This account is billed in a different currency. Please contact support or use a different billing email."
                    });
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Could not verify existing subscription currency for tenant {TenantId}", tenant.Id);
            }
        }

        try
        {
            var sessionOptions = new SessionCreateOptions
            {
                SuccessUrl = options.SuccessUrl,
                CancelUrl = options.CancelUrl,
                Mode = "subscription",
                CustomerEmail = adminEmail,
                Customer = customerId,
                PaymentMethodCollection = "always",
                SubscriptionData = new SessionSubscriptionDataOptions
                {
                    TrialPeriodDays = trialDays > 0 ? trialDays : null,
                    Metadata = new Dictionary<string, string>
                    {
                        ["trial_used"] = (!trialEligible).ToString().ToLowerInvariant()
                    }
                },
                LineItems = new List<SessionLineItemOptions>
                {
                    new() { Price = plan.PriceId, Quantity = 1 }
                },
                Metadata = new Dictionary<string, string>
                {
                    ["planId"] = plan.PlanId,
                    ["companyName"] = companyName,
                    ["adminEmail"] = adminEmail,
                    ["adminName"] = adminName,
                    ["tenantId"] = tenant?.Id.ToString() ?? "signup"
                }
            };

            var service = new SessionService();
            var session = await service.CreateAsync(sessionOptions, cancellationToken: cancellationToken);
            return Results.Ok(new CreateCheckoutSessionResponse(session.Url ?? string.Empty));
        }
        catch (StripeException ex)
        {
            logger.LogError(ex, "Stripe checkout failed for {Email}", adminEmail);
            var friendly = ex.Message.Contains("combine currencies", StringComparison.OrdinalIgnoreCase)
                ? "This email is already tied to a different billing currency in Stripe. Please use another billing email or contact support."
                : "We could not start checkout. Please use a different email or contact support.";
            return Results.BadRequest(new { friendlyError = friendly });
        }
    }

    private static async Task<IResult> HandleWebhookAsync(
        HttpContext context,
        IOptions<StripeOptions> stripeOptions,
        IOptions<MagicLinkOptions> magicOptions,
        ITenantProvisioningService provisioningService,
        IEmailTemplateRenderer renderer,
        IEmailService emailService,
        AppDbContext db,
        CancellationToken cancellationToken)
    {
        var options = stripeOptions.Value;
        var json = await new StreamReader(context.Request.Body).ReadToEndAsync(cancellationToken);
        var signature = context.Request.Headers["Stripe-Signature"];

        Event stripeEvent;
        try
        {
            stripeEvent = EventUtility.ConstructEvent(json, signature, options.WebhookSecret, throwOnApiVersionMismatch: false);
        }
        catch (Exception)
        {
            return Results.BadRequest();
        }

        switch (stripeEvent.Type)
        {
            case Events.CheckoutSessionCompleted:
                await HandleCheckoutCompleted(stripeEvent, options, magicOptions.Value, provisioningService, renderer, emailService, db, cancellationToken);
                break;
            case Events.CustomerSubscriptionCreated:
            case Events.CustomerSubscriptionUpdated:
            case Events.CustomerSubscriptionDeleted:
                await HandleSubscription(stripeEvent, options, db, cancellationToken);
                break;
            case Events.InvoicePaymentSucceeded:
            case Events.InvoicePaymentFailed:
            case Events.InvoiceUpcoming:
                await HandleInvoice(stripeEvent, db, cancellationToken);
                break;
        }

        return Results.Ok();
    }

    private static async Task HandleCheckoutCompleted(Event stripeEvent, StripeOptions options, MagicLinkOptions magicOptions, ITenantProvisioningService provisioningService, IEmailTemplateRenderer renderer, IEmailService emailService, AppDbContext db, CancellationToken token)
    {
        if (stripeEvent.Data.Object is not Session session || session.Metadata is null)
        {
            return;
        }

        var planId = session.Metadata.GetValueOrDefault("planId") ?? "starter";
        var companyName = session.Metadata.GetValueOrDefault("companyName") ?? "New Tenant";
        var adminEmail = session.CustomerDetails?.Email ?? session.Metadata.GetValueOrDefault("adminEmail") ?? "admin@example.com";
        var adminName = session.Metadata.GetValueOrDefault("adminName") ?? adminEmail;
        var tenant = await provisioningService.ProvisionTenantAsync(companyName, planId, adminEmail, adminName, token);

        tenant.StripeCustomerId = session.CustomerId;
        tenant.StripeSubscriptionId = session.SubscriptionId;
        tenant.SubscriptionStatus = "active";
        tenant.BillingEmail = adminEmail;
        await db.SaveChangesAsync(token);

        var planDisplay = options.Plans.FirstOrDefault(p => p.PlanId == planId)?.DisplayName ?? planId;
        var magicLink = MagicLinkTokenService.CreateToken(
            adminEmail,
            tenant.Id,
            magicOptions.Secret,
            TimeSpan.FromMinutes(magicOptions.ExpiryMinutes),
            purpose: "magic",
            rememberDevice: true);
        var link = $"{magicOptions.BaseUrl.TrimEnd('/')}/magic?token={magicLink}";
        var html = renderer.RenderWelcome(companyName, planDisplay, adminName, adminEmail, link);
        await emailService.SendAsync(adminEmail, $"Welcome to CertiWatch ({planDisplay})", html, token);
    }

    private static async Task HandleSubscription(Event stripeEvent, StripeOptions options, AppDbContext db, CancellationToken token)
    {
        if (stripeEvent.Data.Object is not Subscription sub)
        {
            return;
        }

        var tenant = await db.Tenants.FirstOrDefaultAsync(t =>
            t.StripeCustomerId == sub.CustomerId || t.StripeSubscriptionId == sub.Id, token);
        if (tenant is null)
        {
            return;
        }

        tenant.StripeSubscriptionId = sub.Id;
        tenant.SubscriptionStatus = sub.Status;
        tenant.CurrentPeriodEndUtc = sub.CurrentPeriodEnd.ToUniversalTime();
        tenant.CancelAtUtc = sub.CancelAt?.ToUniversalTime();

        var priceId = sub.Items.Data.FirstOrDefault()?.Price?.Id;
        var mappedPlan = options.Plans.FirstOrDefault(p => p.PriceId == priceId);
        if (mappedPlan is not null)
        {
            tenant.Plan = mappedPlan.PlanId;
        }

        await db.SaveChangesAsync(token);
    }

    private static async Task HandleInvoice(Event stripeEvent, AppDbContext db, CancellationToken token)
    {
        if (stripeEvent.Data.Object is not Invoice invoice || string.IsNullOrWhiteSpace(invoice.CustomerId))
        {
            return;
        }

        var tenant = await db.Tenants.FirstOrDefaultAsync(t => t.StripeCustomerId == invoice.CustomerId, token);
        if (tenant is null)
        {
            return;
        }

        var existing = await db.BillingInvoices.FirstOrDefaultAsync(i => i.TenantId == tenant.Id && i.StripeInvoiceId == invoice.Id, token);
        if (existing is null)
        {
            existing = new BillingInvoice
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                StripeInvoiceId = invoice.Id,
                CreatedAt = DateTime.UtcNow
            };
            db.BillingInvoices.Add(existing);
        }

        existing.Currency = invoice.Currency;
        existing.AmountDue = invoice.AmountDue;
        existing.AmountPaid = invoice.AmountPaid;
        existing.Status = invoice.Status ?? "unknown";
        existing.HostedInvoiceUrl = invoice.HostedInvoiceUrl;
        existing.PdfUrl = invoice.InvoicePdf;
        existing.PeriodStartUtc = invoice.PeriodStart.ToUniversalTime();
        existing.PeriodEndUtc = invoice.PeriodEnd.ToUniversalTime();
        existing.InvoiceDateUtc = invoice.Created.ToUniversalTime();

        await db.SaveChangesAsync(token);
    }
}
