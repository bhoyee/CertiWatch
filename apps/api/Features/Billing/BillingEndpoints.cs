using System.IO;
using CertiWatch.Api.Configuration;
using CertiWatch.Api.Infrastructure.Emails;
using CertiWatch.Api.Infrastructure.Services;
using CertiWatch.Contracts.Requests;
using CertiWatch.Contracts.Responses;
using Microsoft.Extensions.Options;
using Stripe;
using Stripe.Checkout;
using CertiWatch.Api.Features.Auth;

namespace CertiWatch.Api.Features.Billing;

public static class BillingEndpoints
{
    public static IEndpointRouteBuilder MapBillingEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/billing");
        group.MapPost("/checkout", CreateCheckoutSessionAsync).AllowAnonymous();
        group.MapPost("/webhook", HandleWebhookAsync).AllowAnonymous();
        return routes;
    }

    private static async Task<IResult> CreateCheckoutSessionAsync(
        CreateCheckoutSessionRequest request,
        IOptions<StripeOptions> stripeOptions,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        var logger = loggerFactory.CreateLogger("Billing");
        var options = stripeOptions.Value;
        var plan = options.Plans.FirstOrDefault(p => string.Equals(p.PlanId, request.PlanId, StringComparison.OrdinalIgnoreCase));
        if (plan is null)
        {
            return Results.BadRequest(new { error = "unknown_plan" });
        }

        var customerService = new CustomerService();
        Customer? existingCustomer = null;
        var searchOptions = new CustomerSearchOptions
        {
            Query = $"email:'{request.AdminEmail}'",
            Limit = 1
        };

        await foreach (var customer in customerService.SearchAutoPagingAsync(searchOptions, cancellationToken: cancellationToken))
        {
            existingCustomer = customer;
            break;
        }

        var trialEligible = true;
        if (existingCustomer?.Metadata != null &&
            existingCustomer.Metadata.TryGetValue("trial_used", out var trialUsed) &&
            string.Equals(trialUsed, "true", StringComparison.OrdinalIgnoreCase))
        {
            trialEligible = false;
        }

        var trialDays = trialEligible ? options.TrialDays : 0;

        try
        {
            var sessionOptions = new SessionCreateOptions
            {
                SuccessUrl = options.SuccessUrl,
                CancelUrl = options.CancelUrl,
                Mode = "subscription",
                CustomerEmail = existingCustomer is null ? request.AdminEmail : null,
                Customer = existingCustomer?.Id,
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
                    ["companyName"] = request.CompanyName,
                    ["adminEmail"] = request.AdminEmail,
                    ["adminName"] = request.AdminName
                }
            };

            var service = new SessionService();
            var session = await service.CreateAsync(sessionOptions, cancellationToken: cancellationToken);
            return Results.Ok(new CreateCheckoutSessionResponse(session.Url ?? string.Empty));
        }
        catch (StripeException ex)
        {
            logger.LogError(ex, "Stripe checkout failed for {Email}", request.AdminEmail);
            return Results.BadRequest(new { friendlyError = "We could not start checkout. Please use a different email or contact support." });
        }
    }

    private static async Task<IResult> HandleWebhookAsync(
        HttpContext context,
        IOptions<StripeOptions> stripeOptions,
        ITenantProvisioningService provisioningService,
        IEmailTemplateRenderer renderer,
        IEmailService emailService,
        CancellationToken cancellationToken)
    {
        var options = stripeOptions.Value;
        var json = await new StreamReader(context.Request.Body).ReadToEndAsync(cancellationToken);
        Event stripeEvent = EventUtility.ParseEvent(json, throwOnApiVersionMismatch: false);

        if (stripeEvent.Type == Events.CheckoutSessionCompleted)
        {
            if (stripeEvent.Data.Object is Session session && session.Metadata != null)
            {
                var planId = session.Metadata.GetValueOrDefault("planId") ?? "starter";
                var companyName = session.Metadata.GetValueOrDefault("companyName") ?? "New Tenant";
                var adminEmail = session.CustomerDetails?.Email ?? session.Metadata.GetValueOrDefault("adminEmail") ?? "admin@example.com";
                var adminName = session.Metadata.GetValueOrDefault("adminName") ?? adminEmail;
                var tenant = await provisioningService.ProvisionTenantAsync(companyName, planId, adminEmail, adminName, cancellationToken);

                var planDisplay = options.Plans.FirstOrDefault(p => p.PlanId == planId)?.DisplayName ?? planId;
                var magicLink = MagicLinkTokenService.CreateToken(
                    adminEmail,
                    tenant.Id,
                    options.MagicLinks.Secret,
                    TimeSpan.FromMinutes(options.MagicLinks.ExpiryMinutes),
                    purpose: "magic",
                    rememberDevice: true);
                var link = $"{options.MagicLinks.BaseUrl.TrimEnd('/')}/magic?token={magicLink}";
                var html = renderer.RenderWelcome(companyName, planDisplay, adminName, adminEmail, link);
                await emailService.SendAsync(adminEmail, $"Welcome to CertiWatch ({planDisplay})", html, cancellationToken);

                if (!string.IsNullOrWhiteSpace(session.CustomerId))
                {
                    var customerService = new CustomerService();
                    await customerService.UpdateAsync(
                        session.CustomerId,
                        new CustomerUpdateOptions
                        {
                            Metadata = new Dictionary<string, string> { ["trial_used"] = "true" }
                        },
                        requestOptions: null,
                        cancellationToken: cancellationToken);
                }
            }
        }

        return Results.Ok();
    }
}
