using CertiWatch.Api.Domain.Entities;
using CertiWatch.Api.Features.Records;
using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Infrastructure.Services;
using CertiWatch.Api.Infrastructure.Emails;
using CertiWatch.Contracts.Enums;
using Microsoft.EntityFrameworkCore;

namespace CertiWatch.Api.Infrastructure.Jobs;

public sealed class ReminderSender : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IEmailService _emailService;
    private readonly IEmailTemplateRenderer _renderer;
    private readonly IDateTimeProvider _clock;
    private readonly ILogger<ReminderSender> _logger;

    public ReminderSender(IServiceScopeFactory scopeFactory, IEmailService emailService, IEmailTemplateRenderer renderer, IDateTimeProvider clock, ILogger<ReminderSender> logger)
    {
        _scopeFactory = scopeFactory;
        _emailService = emailService;
        _renderer = renderer;
        _clock = clock;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
                await SendDueRemindersAsync(stoppingToken);
                await CreateExpiredNotificationsAsync(stoppingToken);
            }
            catch (TaskCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Reminder sender failed");
            }
        }
    }

    private async Task SendDueRemindersAsync(CancellationToken token)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var now = _clock.UtcNow;
        var due = await db.Reminders
            .Include(r => r.Record)
            .Where(r => r.SentAt == null && r.ScheduledFor <= now)
            .ToListAsync(token);

        foreach (var reminder in due)
        {
            if (reminder.Record is null || reminder.Record.ProcessingStatus == ProcessingStatus.Failed)
            {
                reminder.SentAt = now;
                continue;
            }

            var admins = await db.Users.AsNoTracking()
                .Where(u => u.TenantId == reminder.TenantId && u.Role == "admin")
                .ToListAsync(token);

            if (admins.Count == 0)
            {
                reminder.SentAt = now;
                continue;
            }

            var recordDto = RecordsEndpoints.ToDtoForReport(reminder.Record);
            var reminderDate = reminder.Record.ExpiryDate ?? DateOnly.FromDateTime(now.Date);

            foreach (var admin in admins)
            {
                var subject = $"Certificate expiring soon: {recordDto.CourseName}";
                var body = _renderer.RenderReminder(recordDto, reminderDate);
                await _emailService.SendAsync(admin.Email, subject, body, token);
            }

            // Tenant-wide in-app bell entry alongside the email - same trigger, same lead-day
            // cadence already established by ReminderScheduler, so no separate dedup logic needed.
            var daysLeft = reminder.Record.ExpiryDate!.Value.DayNumber - DateOnly.FromDateTime(now).DayNumber;
            db.Notifications.Add(new Notification
            {
                Id = Guid.NewGuid(),
                TenantId = reminder.TenantId,
                RecordId = reminder.RecordId,
                Type = "expiring",
                Title = $"{reminder.Record.CourseName} expiring soon",
                Body = $"{reminder.Record.StaffName}'s {reminder.Record.CourseName} expires in {daysLeft} day{(daysLeft == 1 ? "" : "s")} ({reminderDate:d MMM yyyy}).",
                CreatedAt = now
            });

            reminder.SentAt = _clock.UtcNow;
        }

        if (due.Count > 0)
        {
            await db.SaveChangesAsync(token);
        }
    }

    // Reminders only ever fire before expiry (see ReminderScheduler) - nothing currently flags
    // the moment a record actually crosses its expiry date, so the bell would never show it.
    private async Task CreateExpiredNotificationsAsync(CancellationToken token)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var today = DateOnly.FromDateTime(_clock.UtcNow);
        var newlyExpired = await db.Records.AsNoTracking()
            .Where(r => r.ExpiryDate != null && r.ExpiryDate < today
                && r.ProcessingStatus != ProcessingStatus.Failed
                && !db.Notifications.Any(n => n.RecordId == r.Id && n.Type == "expired"))
            .ToListAsync(token);

        if (newlyExpired.Count == 0)
        {
            return;
        }

        var now = _clock.UtcNow;
        foreach (var record in newlyExpired)
        {
            db.Notifications.Add(new Notification
            {
                Id = Guid.NewGuid(),
                TenantId = record.TenantId,
                RecordId = record.Id,
                Type = "expired",
                Title = $"{record.CourseName} has expired",
                Body = $"{record.StaffName}'s {record.CourseName} expired on {record.ExpiryDate:d MMM yyyy}.",
                CreatedAt = now
            });
        }

        await db.SaveChangesAsync(token);
    }
}
