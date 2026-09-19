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

    // Null means "no cap" (unlimited plan). Otherwise, the billable unit is a distinct (staff,
    // requirement) PAIR - not a raw record row - grouped the same case-insensitive way the
    // Compliance matrix already matches a record to a person/requirement. Counting raw rows would
    // charge a tenant more every time an existing certificate simply renews, so a stable, non-
    // growing organisation would eventually blow through any fixed cap purely from renewal
    // history piling up over the years, with no actual growth involved. Grouping by pair first
    // means a renewal of something already tracked is free; only a genuinely new staff member or
    // a newly-tracked requirement consumes more of the allowance. The oldest `limit` pairs (by
    // when each was first seen) are "active" - stable and predictable, same as before, and
    // upgrading reveals every pair (and its full renewal history) that was already there.
    internal static async Task<HashSet<Guid>?> GetActiveRecordIdsAsync(AppDbContext db, IOptions<StripeOptions> stripeOptions, Guid tenantId, CancellationToken token)
    {
        var limit = await GetRecordLimitAsync(db, stripeOptions, tenantId, token);
        if (limit <= 0)
        {
            return null;
        }

        var pairs = await GetTrackedPairsAsync(db, tenantId, token);
        var activeIds = pairs
            .OrderBy(p => p.FirstSeenAt)
            .Take(limit)
            .SelectMany(p => p.RecordIds);
        return activeIds.ToHashSet();
    }

    // Distinct (staff, requirement) pairs ever tracked - the actual billable unit, shown on the
    // plan usage banner so what's displayed matches what's gated (a raw record count would look
    // like it's growing every renewal even though the allowance itself isn't being spent).
    internal static async Task<int> GetTrackedItemCountAsync(AppDbContext db, Guid tenantId, CancellationToken token)
    {
        var pairs = await GetTrackedPairsAsync(db, tenantId, token);
        return pairs.Count;
    }

    private static async Task<List<(string Key, DateTime FirstSeenAt, List<Guid> RecordIds)>> GetTrackedPairsAsync(AppDbContext db, Guid tenantId, CancellationToken token)
    {
        var records = await db.Records.AsNoTracking()
            .Where(r => r.TenantId == tenantId)
            .Select(r => new { r.Id, r.StaffName, r.CourseName, r.CreatedAt })
            .ToListAsync(token);

        return records
            .GroupBy(r => $"{r.StaffName.Trim().ToLowerInvariant()}{r.CourseName.Trim().ToLowerInvariant()}")
            .Select(g => (Key: g.Key, FirstSeenAt: g.Min(r => r.CreatedAt), RecordIds: g.Select(r => r.Id).ToList()))
            .ToList();
    }
}
