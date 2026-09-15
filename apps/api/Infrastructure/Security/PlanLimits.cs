using CertiWatch.Api.Configuration;
using CertiWatch.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace CertiWatch.Api.Infrastructure.Security;

// Nothing previously enforced a tenant's plan RecordLimit at all - it was purely a number shown on
// the plan banner, so a tenant could ingest and browse an unlimited number of records regardless
// of plan. This gates the tenant-facing record surfaces (list/export/review-count) to the plan's
// allowance without ever discarding or blocking ingestion: everything still gets fully processed
// and stored, just not shown until the tenant's limit covers it.
internal static class PlanLimits
{
    // 0 (or no matching plan) means unlimited - matches the Pro plan's configured RecordLimit.
    internal static async Task<int> GetRecordLimitAsync(AppDbContext db, IOptions<StripeOptions> stripeOptions, Guid tenantId, CancellationToken token)
    {
        var planId = await db.Tenants.AsNoTracking()
            .Where(t => t.Id == tenantId)
            .Select(t => t.Plan)
            .FirstOrDefaultAsync(token);
        var plan = stripeOptions.Value.Plans.FirstOrDefault(p => p.PlanId == planId);
        return plan?.RecordLimit ?? 0;
    }

    // Null means "no cap" (unlimited plan). Otherwise, the oldest `limit` records by CreatedAt are
    // what count as "active" toward the plan - stable and predictable (a record, once counted,
    // never drops out just because newer ones arrived), and upgrading naturally reveals every
    // record that was already there and fully processed, since the set is always "oldest N" rather
    // than a fixed cutoff.
    internal static async Task<HashSet<Guid>?> GetActiveRecordIdsAsync(AppDbContext db, IOptions<StripeOptions> stripeOptions, Guid tenantId, CancellationToken token)
    {
        var limit = await GetRecordLimitAsync(db, stripeOptions, tenantId, token);
        if (limit <= 0)
        {
            return null;
        }

        var ids = await db.Records.AsNoTracking()
            .Where(r => r.TenantId == tenantId)
            .OrderBy(r => r.CreatedAt)
            .Take(limit)
            .Select(r => r.Id)
            .ToListAsync(token);
        return ids.ToHashSet();
    }
}
