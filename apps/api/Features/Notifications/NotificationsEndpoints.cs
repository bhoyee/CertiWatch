using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Infrastructure.Security;
using CertiWatch.Api.Infrastructure.Services;
using CertiWatch.Contracts.Dtos;
using CertiWatch.Contracts.Enums;
using Microsoft.EntityFrameworkCore;

namespace CertiWatch.Api.Features.Notifications;

public static class NotificationsEndpoints
{
    public static IEndpointRouteBuilder MapNotificationEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/notifications").RequireAuthorization();
        group.MapGet("/reminders", RemindersAsync);
        group.MapGet("/reminders/preview", ReminderPreviewAsync);
        return group;
    }

    private static async Task<IResult> RemindersAsync(AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        var tenantId = accessor.Current.TenantId;
        var viewerScope = await RecordVisibility.GetViewerScopeAsync(db, accessor, token);
        var remindersQuery = db.Reminders.AsNoTracking()
            .Where(r => r.TenantId == tenantId);

        if (viewerScope is not null)
        {
            var recordQuery = RecordVisibility.ApplyViewerScope(
                db.Records.AsNoTracking().Where(r => r.TenantId == tenantId),
                viewerScope);
            remindersQuery = remindersQuery.Where(r => recordQuery.Select(rr => rr.Id).Contains(r.RecordId));
        }

        var reminders = await remindersQuery
            .OrderBy(r => r.ScheduledFor)
            .ToListAsync(token);

        return Results.Ok(reminders.Select(r => new ReminderDto(r.Id, r.Type, r.RecordId, r.ScheduledFor, r.SentAt)));
    }

    private static async Task<IResult> ReminderPreviewAsync(AppDbContext db, ITenantContextAccessor accessor, IDateTimeProvider clock, CancellationToken token)
    {
        var tenantId = accessor.Current.TenantId;
        var now = DateOnly.FromDateTime(clock.UtcNow);
        var horizon7 = now.AddDays(7);
        var horizon30 = now.AddDays(30);

        var viewerScope = await RecordVisibility.GetViewerScopeAsync(db, accessor, token);
        var recordQuery = db.Records.AsNoTracking()
            .Where(r => r.TenantId == tenantId && r.ExpiryDate != null);
        recordQuery = RecordVisibility.ApplyViewerScope(recordQuery, viewerScope);

        var records = await recordQuery
            .Select(r => new { r.Id, r.StaffName, r.CourseName, r.ExpiryDate, r.ProcessingStatus })
            .ToListAsync(token);

        var expiring7 = records.Count(r => r.ExpiryDate >= now && r.ExpiryDate <= horizon7);
        var expiring30 = records.Count(r => r.ExpiryDate >= now && r.ExpiryDate <= horizon30);
        var needsReview = records.Count(r => r.ProcessingStatus == ProcessingStatus.NeedsReview);

        var upcoming = records
            .Where(r => r.ExpiryDate >= now && r.ExpiryDate <= horizon30)
            .OrderBy(r => r.ExpiryDate)
            .Take(10)
            .Select(r => new
            {
                r.Id,
                r.StaffName,
                r.CourseName,
                ExpiryDate = r.ExpiryDate!.Value.ToString("yyyy-MM-dd")
            })
            .ToList();

        return Results.Ok(new
        {
            expiringIn7 = expiring7,
            expiringIn30 = expiring30,
            needsReview,
            upcoming
        });
    }
}
