using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Infrastructure.Security;
using CertiWatch.Contracts.Dtos;
using Microsoft.EntityFrameworkCore;

namespace CertiWatch.Api.Features.Notifications;

public static class NotificationsEndpoints
{
    public static IEndpointRouteBuilder MapNotificationEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/notifications").RequireAuthorization();
        group.MapGet("/reminders", RemindersAsync);
        return group;
    }

    private static async Task<IResult> RemindersAsync(AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        var reminders = await db.Reminders.AsNoTracking()
            .Where(r => r.TenantId == accessor.Current.TenantId)
            .OrderBy(r => r.ScheduledFor)
            .ToListAsync(token);

        return Results.Ok(reminders.Select(r => new ReminderDto(r.Id, r.Type, r.RecordId, r.ScheduledFor, r.SentAt)));
    }
}
