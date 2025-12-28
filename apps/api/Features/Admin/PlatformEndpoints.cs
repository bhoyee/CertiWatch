using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;

namespace CertiWatch.Api.Features.Admin;

public static class PlatformEndpoints
{
    public static IEndpointRouteBuilder MapPlatformEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/platform").RequireAuthorization();
        group.MapGet("/tenants", ListTenantsAsync);
        group.MapGet("/tenants/{id:guid}", GetTenantAsync);
        return group;
    }

    private static bool IsSuperAdmin(ITenantContextAccessor accessor) =>
        string.Equals(accessor.Current.Role, "superadmin", StringComparison.OrdinalIgnoreCase);

    private static async Task<IResult> ListTenantsAsync(AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        if (!IsSuperAdmin(accessor)) return Results.Forbid();

        var tenants = await db.Tenants.AsNoTracking().OrderBy(t => t.CreatedAtUtc).ToListAsync(token);

        var recordCounts = await db.Records.AsNoTracking()
            .GroupBy(r => r.TenantId)
            .Select(g => new { TenantId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.TenantId, x => x.Count, token);

        var userCounts = await db.Users.AsNoTracking()
            .GroupBy(u => u.TenantId)
            .Select(g => new { TenantId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.TenantId, x => x.Count, token);

        var result = tenants.Select(t => new
        {
            t.Id,
            t.Name,
            t.Plan,
            t.CreatedAtUtc,
            t.SubscriptionStatus,
            t.CurrentPeriodEndUtc,
            t.StripeCustomerId,
            t.StripeSubscriptionId,
            RecordCount = recordCounts.TryGetValue(t.Id, out var rc) ? rc : 0,
            UserCount = userCounts.TryGetValue(t.Id, out var uc) ? uc : 0
        });

        return Results.Ok(result);
    }

    private static async Task<IResult> GetTenantAsync(Guid id, AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        if (!IsSuperAdmin(accessor)) return Results.Forbid();

        var tenant = await db.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id, token);
        if (tenant is null) return Results.NotFound();

        var recordCount = await db.Records.AsNoTracking().CountAsync(r => r.TenantId == id, token);
        var userCount = await db.Users.AsNoTracking().CountAsync(u => u.TenantId == id, token);
        var deviceCount = await db.Devices.AsNoTracking().CountAsync(d => d.TenantId == id, token);
        var sourceCount = await db.Sources.AsNoTracking().CountAsync(s => s.TenantId == id, token);

        return Results.Ok(new
        {
            tenant.Id,
            tenant.Name,
            tenant.Plan,
            tenant.CreatedAtUtc,
            tenant.SubscriptionStatus,
            tenant.CurrentPeriodEndUtc,
            tenant.StripeCustomerId,
            tenant.StripeSubscriptionId,
            tenant.BillingEmail,
            RecordCount = recordCount,
            UserCount = userCount,
            DeviceCount = deviceCount,
            SourceCount = sourceCount
        });
    }
}
