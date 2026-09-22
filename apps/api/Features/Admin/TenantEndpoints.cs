using CertiWatch.Api.Infrastructure.Jobs;
using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Infrastructure.Security;
using CertiWatch.Contracts.Dtos;
using CertiWatch.Contracts.Requests;
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
        group.MapGet("/reminder-settings", GetReminderSettingsAsync);
        group.MapPatch("/reminder-settings", UpdateReminderSettingsAsync);
        group.MapGet("/manager-visibility", GetManagerVisibilityAsync);
        group.MapPatch("/manager-visibility", UpdateManagerVisibilityAsync);
        group.MapGet("/upload-destination", GetUploadDestinationAsync);
        group.MapPatch("/upload-destination", UpdateUploadDestinationAsync);
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

        // Distinct (staff, requirement) pairs, not raw record rows - matches what PlanLimits
        // actually gates, so a home renewing existing certificates never sees this number climb
        // toward the limit on its own; only a genuinely new person or requirement does.
        var recordCount = await PlanLimits.GetTrackedItemCountAsync(db, tenantId, token);
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

    // Admin-only, same gate as the requirement-types page this setting lives next to on the
    // frontend - a tenant-wide schedule isn't something a manager or viewer should be able to
    // change.
    private static async Task<IResult> GetReminderSettingsAsync(
        AppDbContext db,
        ITenantContextAccessor accessor,
        IOptions<ReminderOptions> reminderOptions,
        CancellationToken token)
    {
        if (!RecordVisibility.IsAdmin(accessor))
        {
            return Results.Forbid();
        }

        var tenantId = accessor.Current.TenantId;
        var csv = await db.Tenants.AsNoTracking().Where(t => t.Id == tenantId).Select(t => t.ReminderLeadDaysCsv).FirstOrDefaultAsync(token);
        var custom = ReminderLeadDays.Parse(csv);
        var defaultDays = reminderOptions.Value.LeadDays;

        return Results.Ok(new TenantReminderSettingsDto(
            LeadDays: custom ?? defaultDays,
            IsCustom: custom is not null,
            DefaultLeadDays: defaultDays));
    }

    private static async Task<IResult> UpdateReminderSettingsAsync(
        UpdateTenantReminderSettingsRequest request,
        AppDbContext db,
        ITenantContextAccessor accessor,
        IOptions<ReminderOptions> reminderOptions,
        CancellationToken token)
    {
        if (!RecordVisibility.IsAdmin(accessor))
        {
            return Results.Forbid();
        }

        var tenantId = accessor.Current.TenantId;
        var tenant = await db.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId, token);
        if (tenant is null)
        {
            return Results.NotFound();
        }

        var defaultDays = reminderOptions.Value.LeadDays;

        if (request.LeadDays is null || request.LeadDays.Count == 0)
        {
            tenant.ReminderLeadDaysCsv = null;
            await db.SaveChangesAsync(token);
            return Results.Ok(new TenantReminderSettingsDto(defaultDays, IsCustom: false, DefaultLeadDays: defaultDays));
        }

        var (ok, error, cleaned) = ReminderLeadDays.Validate(request.LeadDays);
        if (!ok)
        {
            return Results.BadRequest(new { error });
        }

        tenant.ReminderLeadDaysCsv = ReminderLeadDays.ToCsv(cleaned);
        await db.SaveChangesAsync(token);
        return Results.Ok(new TenantReminderSettingsDto(cleaned, IsCustom: true, DefaultLeadDays: defaultDays));
    }

    // Admin-only - whether managers see every tenant record or just their own scope is a
    // trust decision for this tenant's own admin to make, not something a manager grants
    // themselves.
    private static async Task<IResult> GetManagerVisibilityAsync(AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        if (!RecordVisibility.IsAdmin(accessor))
        {
            return Results.Forbid();
        }

        var tenantId = accessor.Current.TenantId;
        var seesAll = await db.Tenants.AsNoTracking().Where(t => t.Id == tenantId).Select(t => t.ManagerSeesAllRecords).FirstOrDefaultAsync(token);
        return Results.Ok(new { managerSeesAllRecords = seesAll });
    }

    private sealed record UpdateManagerVisibilityRequest(bool ManagerSeesAllRecords);

    private static async Task<IResult> UpdateManagerVisibilityAsync(
        UpdateManagerVisibilityRequest request,
        AppDbContext db,
        ITenantContextAccessor accessor,
        CancellationToken token)
    {
        if (!RecordVisibility.IsAdmin(accessor))
        {
            return Results.Forbid();
        }

        var tenantId = accessor.Current.TenantId;
        var tenant = await db.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId, token);
        if (tenant is null)
        {
            return Results.NotFound();
        }

        tenant.ManagerSeesAllRecords = request.ManagerSeesAllRecords;
        await db.SaveChangesAsync(token);
        return Results.Ok(new { managerSeesAllRecords = tenant.ManagerSeesAllRecords });
    }

    // Admin-only, same reasoning as manager visibility above - where a staff upload link/Upload
    // page file lands is a tenant-wide policy choice, not something to infer silently. Doesn't
    // validate that the chosen provider is actually connected - DocumentIngestionWorker's
    // resolution already falls through gracefully if it isn't (disconnecting a source later
    // shouldn't require also clearing this setting).
    private static async Task<IResult> GetUploadDestinationAsync(AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        if (!RecordVisibility.IsAdmin(accessor))
        {
            return Results.Forbid();
        }

        var tenantId = accessor.Current.TenantId;
        var preferred = await db.Tenants.AsNoTracking().Where(t => t.Id == tenantId).Select(t => t.PreferredUploadProvider).FirstOrDefaultAsync(token);
        return Results.Ok(new { preferredUploadProvider = preferred });
    }

    private sealed record UpdateUploadDestinationRequest(string? PreferredUploadProvider);

    private static async Task<IResult> UpdateUploadDestinationAsync(
        UpdateUploadDestinationRequest request,
        AppDbContext db,
        ITenantContextAccessor accessor,
        CancellationToken token)
    {
        if (!RecordVisibility.IsAdmin(accessor))
        {
            return Results.Forbid();
        }

        var normalized = request.PreferredUploadProvider?.Trim().ToLowerInvariant();
        if (normalized is not (null or "" or "gdrive" or "onedrive"))
        {
            return Results.BadRequest(new { error = "PreferredUploadProvider must be 'gdrive', 'onedrive', or null" });
        }

        var tenantId = accessor.Current.TenantId;
        var tenant = await db.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId, token);
        if (tenant is null)
        {
            return Results.NotFound();
        }

        tenant.PreferredUploadProvider = string.IsNullOrEmpty(normalized) ? null : normalized;
        await db.SaveChangesAsync(token);
        return Results.Ok(new { preferredUploadProvider = tenant.PreferredUploadProvider });
    }
}
