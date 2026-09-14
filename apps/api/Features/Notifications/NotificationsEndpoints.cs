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

    private sealed record NotificationDto(Guid Id, Guid? RecordId, Guid? TicketId, string Type, string Title, string Body, bool IsRead, DateTime CreatedAt);

    // The bell mirrors who the email reminders already go to (tenant admins) plus managers, who
    // can see the same compliance picture elsewhere in the app - not viewers, matching every
    // other cross-staff visibility surface (Compliance, Staff) already being viewer-hidden.
    private static bool CanSeeBell(ITenantContextAccessor accessor) =>
        RecordVisibility.IsAdmin(accessor) || RecordVisibility.IsManager(accessor);

    private static async Task<IResult> FeedAsync(AppDbContext db, ITenantContextAccessor accessor, int? take, CancellationToken token)
    {
        var limit = Math.Clamp(take ?? 20, 5, 100);
        var tenantId = accessor.Current.TenantId;
        var query = db.Notifications.AsNoTracking().Where(n => n.TenantId == tenantId);

        if (!CanSeeBell(accessor))
        {
            query = await ScopeToOwnTicketsAsync(db, accessor, query, token);
        }

        var items = await query
            .OrderByDescending(n => n.CreatedAt)
            .Take(limit)
            .Select(n => new NotificationDto(n.Id, n.RecordId, n.TicketId, n.Type, n.Title, n.Body, n.IsRead, n.CreatedAt))
            .ToListAsync(token);

        return Results.Ok(items);
    }

    private static async Task<IResult> UnreadCountAsync(AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        var tenantId = accessor.Current.TenantId;
        var query = db.Notifications.Where(n => n.TenantId == tenantId && !n.IsRead);

        if (!CanSeeBell(accessor))
        {
            query = await ScopeToOwnTicketsAsync(db, accessor, query, token);
        }

        var count = await query.CountAsync(token);
        return Results.Ok(new { count });
    }

    // A viewer doesn't get the general compliance bell (see CanSeeBell), but they should still
    // hear about their own support tickets - narrow the feed to just that instead of opening the
    // whole tenant-wide bell to them.
    private static async Task<IQueryable<CertiWatch.Api.Domain.Entities.Notification>> ScopeToOwnTicketsAsync(
        AppDbContext db,
        ITenantContextAccessor accessor,
        IQueryable<CertiWatch.Api.Domain.Entities.Notification> query,
        CancellationToken token)
    {
        var tenantId = accessor.Current.TenantId;
        var userId = accessor.Current.UserId;
        var ownTicketIds = await db.SupportTickets.AsNoTracking()
            .Where(t => t.TenantId == tenantId && t.CreatedByUserId == userId)
            .Select(t => t.Id)
            .ToListAsync(token);
        return query.Where(n => n.TicketId != null && ownTicketIds.Contains(n.TicketId.Value));
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
        var query = db.Notifications.Where(n => n.TenantId == tenantId && !n.IsRead);

        if (!CanSeeBell(accessor))
        {
            query = await ScopeToOwnTicketsAsync(db, accessor, query, token);
        }

        await query.ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true).SetProperty(n => n.ReadAt, now), token);
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
