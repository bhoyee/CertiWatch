using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Infrastructure.Security;
using CertiWatch.Contracts.Dtos;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using CertiWatch.Api.Configuration;

namespace CertiWatch.Api.Features.Admin;

public static class TenantEndpoints
{
    public static IEndpointRouteBuilder MapTenantEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/tenant").RequireAuthorization();
        group.MapGet("/me", GetAsync);
        return group;
    }

    private static async Task<IResult> GetAsync(AppDbContext db, ITenantContextAccessor accessor, IOptions<StripeOptions> stripeOptions, CancellationToken token)
    {
        var tenantId = accessor.Current.TenantId;
        var tenant = await db.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == tenantId, token);
        if (tenant is null)
        {
            return Results.NotFound();
        }

        var recordCount = await db.Records.AsNoTracking().CountAsync(r => r.TenantId == tenantId, token);
        var deviceCount = await db.Devices.AsNoTracking().CountAsync(d => d.TenantId == tenantId, token);
        var sourceCount = await db.Sources.AsNoTracking().CountAsync(s => s.TenantId == tenantId, token);

        var plan = stripeOptions.Value.Plans.FirstOrDefault(p => p.PlanId == tenant.Plan);
        var planDisplay = plan?.DisplayName ?? tenant.Plan;
        var recordLimit = plan?.RecordLimit ?? 0;

        var dto = new TenantPlanDto(
            tenant.Name,
            tenant.Plan,
            planDisplay,
            recordLimit,
            recordCount,
            deviceCount,
            sourceCount,
            tenant.SubscriptionStatus,
            tenant.CurrentPeriodEndUtc);
        return Results.Ok(dto);
    }
}
