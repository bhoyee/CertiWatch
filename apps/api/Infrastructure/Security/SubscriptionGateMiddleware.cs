using CertiWatch.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CertiWatch.Api.Infrastructure.Security;

public sealed class SubscriptionGateMiddleware
{
    private readonly RequestDelegate _next;
    private static readonly string[] AllowedPrefixes =
    {
        "/api/auth",
        "/api/billing",
        "/api/tenant/me",
        "/api/profile"
    };

    public SubscriptionGateMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, ITenantContextAccessor accessor, AppDbContext db)
    {
        var path = context.Request.Path.Value ?? string.Empty;
        if (!path.StartsWith("/api", StringComparison.OrdinalIgnoreCase) ||
            AllowedPrefixes.Any(prefix => path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)))
        {
            await _next(context);
            return;
        }

        var tenantId = accessor.Current.TenantId;
        if (tenantId == Guid.Empty)
        {
            await _next(context);
            return;
        }

        var tenant = await db.Tenants.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == tenantId, context.RequestAborted);
        if (tenant is null)
        {
            await _next(context);
            return;
        }

        if (IsSubscriptionActive(tenant.SubscriptionStatus, tenant.CurrentPeriodEndUtc))
        {
            await _next(context);
            return;
        }

        context.Response.StatusCode = StatusCodes.Status402PaymentRequired;
        await context.Response.WriteAsJsonAsync(new
        {
            error = "payment_required",
            message = "Subscription inactive. Please update your payment details."
        });
    }

    private static bool IsSubscriptionActive(string? status, DateTimeOffset? currentPeriodEndUtc)
    {
        if (string.IsNullOrWhiteSpace(status))
        {
            return true;
        }

        var normalized = status.Trim().ToLowerInvariant();
        if (normalized is "active" or "trialing")
        {
            return true;
        }

        if (normalized is "canceled" && currentPeriodEndUtc.HasValue && currentPeriodEndUtc.Value > DateTimeOffset.UtcNow)
        {
            return true;
        }

        return false;
    }
}
