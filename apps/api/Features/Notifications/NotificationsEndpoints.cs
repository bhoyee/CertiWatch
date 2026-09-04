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
        group.MapGet("/feed", FeedAsync);
        group.MapGet("/unread-count", UnreadCountAsync);
        group.MapPost("/{id:guid}/read", MarkReadAsync);
        group.MapPost("/read-all", MarkAllReadAsync);
        return group;
    }

    private sealed record NotificationDto(Guid Id, Guid? RecordId, string Type, string Title, string Body, bool IsRead, DateTime CreatedAt);

    // The bell mirrors who the email reminders already go to (tenant admins) plus managers, who
    // can see the same compliance picture elsewhere in the app - not viewers, matching every
    // other cross-staff visibility surface (Compliance, Staff) already being viewer-hidden.
    private static bool CanSeeBell(ITenantContextAccessor accessor) =>
        RecordVisibility.IsAdmin(accessor) || RecordVisibility.IsManager(accessor);

    private static async Task<IResult> FeedAsync(AppDbContext db, ITenantContextAccessor accessor, int? take, CancellationToken token)
    {
        if (!CanSeeBell(accessor)) return Results.Ok(Array.Empty<NotificationDto>());

        var limit = Math.Clamp(take ?? 20, 5, 100);
        var tenantId = accessor.Current.TenantId;
        var items = await db.Notifications.AsNoTracking()
            .Where(n => n.TenantId == tenantId)
            .OrderByDescending(n => n.CreatedAt)
            .Take(limit)
            .Select(n => new NotificationDto(n.Id, n.RecordId, n.Type, n.Title, n.Body, n.IsRead, n.CreatedAt))
            .ToListAsync(token);

        return Results.Ok(items);
    }

    private static async Task<IResult> UnreadCountAsync(AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        if (!CanSeeBell(accessor)) return Results.Ok(new { count = 0 });

        var tenantId = accessor.Current.TenantId;
        var count = await db.Notifications.CountAsync(n => n.TenantId == tenantId && !n.IsRead, token);
        return Results.Ok(new { count });
    }

    private static async Task<IResult> MarkReadAsync(Guid id, AppDbContext db, ITenantContextAccessor accessor, IDateTimeProvider clock, CancellationToken token)
    {
        var tenantId = accessor.Current.TenantId;
        var notification = await db.Notifications.FirstOrDefaultAsync(n => n.Id == id && n.TenantId == tenantId, token);
        if (notification is null) return Results.NotFound();

        notification.IsRead = true;
        notification.ReadAt = clock.UtcNow;
        await db.SaveChangesAsync(token);
        return Results.NoContent();
    }

    private static async Task<IResult> MarkAllReadAsync(AppDbContext db, ITenantContextAccessor accessor, IDateTimeProvider clock, CancellationToken token)
    {
        var tenantId = accessor.Current.TenantId;
        var now = clock.UtcNow;
        await db.Notifications
            .Where(n => n.TenantId == tenantId && !n.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true).SetProperty(n => n.ReadAt, now), token);
        return Results.NoContent();
    }

    private static async Task<IResult> RemindersAsync(AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        var tenantId = accessor.Current.TenantId;
        var scope = await RecordVisibility.GetScopeAsync(db, accessor, token);
        var remindersQuery = db.Reminders.AsNoTracking()
            .Where(r => r.TenantId == tenantId);

        if (scope is not null)
        {
            var recordQuery = RecordVisibility.ApplyScope(
                db.Records.AsNoTracking().Where(r => r.TenantId == tenantId),
                scope);
            var recordIds = recordQuery.AsEnumerable().Select(rr => rr.Id).ToHashSet();
            remindersQuery = remindersQuery.Where(r => recordIds.Contains(r.RecordId));
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

        var scope = await RecordVisibility.GetScopeAsync(db, accessor, token);
        var recordQuery = db.Records.AsNoTracking()
            .Where(r => r.TenantId == tenantId && r.ExpiryDate != null);
        recordQuery = RecordVisibility.ApplyScope(recordQuery, scope);

        var records = recordQuery
            .AsEnumerable()
            .Select(r => new { r.Id, r.StaffName, r.CourseName, r.ExpiryDate, r.ProcessingStatus })
            .ToList();

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
