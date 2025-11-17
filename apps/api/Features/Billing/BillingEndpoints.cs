using System.IO;
using CertiWatch.Api.Configuration;
using CertiWatch.Api.Infrastructure.Services;
using CertiWatch.Contracts.Requests;
using CertiWatch.Contracts.Responses;
using Microsoft.Extensions.Options;
using Stripe;
using Stripe.Checkout;

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
        CancellationToken cancellationToken)
    {
        var options = stripeOptions.Value;
        var plan = options.Plans.FirstOrDefault(p => string.Equals(p.PlanId, request.PlanId, StringComparison.OrdinalIgnoreCase));
        if (plan is null)
        {
            return Results.BadRequest(new { error = "unknown_plan" });
        }

        var sessionOptions = new SessionCreateOptions
        {
            SuccessUrl = options.SuccessUrl,
            CancelUrl = options.CancelUrl,
            Mode = "subscription",
            CustomerEmail = request.AdminEmail,
            SubscriptionData = new SessionSubscriptionDataOptions
            {
                TrialPeriodDays = options.TrialDays
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

    private static async Task<IResult> HandleWebhookAsync(
        HttpContext context,
        IOptions<StripeOptions> stripeOptions,
        ITenantProvisioningService provisioningService,
        CancellationToken cancellationToken)
    {
        var options = stripeOptions.Value;
        var json = await new StreamReader(context.Request.Body).ReadToEndAsync(cancellationToken);
        var signature = context.Request.Headers["Stripe-Signature"].ToString();

        Event stripeEvent;
        try
        {
            stripeEvent = EventUtility.ConstructEvent(json, signature, options.WebhookSecret);
        }
        catch (Exception ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }

        if (stripeEvent.Type == Events.CheckoutSessionCompleted)
        {
            if (stripeEvent.Data.Object is Session session && session.Metadata != null)
            {
                var planId = session.Metadata.GetValueOrDefault("planId") ?? "starter";
                var companyName = session.Metadata.GetValueOrDefault("companyName") ?? "New Tenant";
                var adminEmail = session.CustomerDetails?.Email ?? session.Metadata.GetValueOrDefault("adminEmail") ?? "admin@example.com";
                var adminName = session.Metadata.GetValueOrDefault("adminName") ?? adminEmail;
                await provisioningService.ProvisionTenantAsync(companyName, planId, adminEmail, adminName, cancellationToken);
            }
        }

        return Results.Ok();
    }
}
