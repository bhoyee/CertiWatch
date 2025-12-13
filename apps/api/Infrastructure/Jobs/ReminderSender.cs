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

            reminder.SentAt = _clock.UtcNow;
        }

        if (due.Count > 0)
        {
            await db.SaveChangesAsync(token);
        }
    }
}
