using CertiWatch.Api.Configuration;
using CertiWatch.Api.Domain.Entities;
using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Infrastructure.Services;
using CertiWatch.Contracts.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace CertiWatch.Api.Infrastructure.Jobs;

public sealed class ReminderScheduler : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ReminderOptions _options;
    private readonly IDateTimeProvider _clock;
    private readonly ILogger<ReminderScheduler> _logger;

    public ReminderScheduler(IServiceScopeFactory scopeFactory, IOptions<ReminderOptions> options, IDateTimeProvider clock, ILogger<ReminderScheduler> logger)
    {
        _scopeFactory = scopeFactory;
        _options = options.Value;
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
                await ScheduleRemindersAsync(stoppingToken);
            }
            catch (TaskCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Reminder scheduler failed");
            }
        }
    }

    private async Task ScheduleRemindersAsync(CancellationToken token)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var now = _clock.UtcNow;

        var candidates = await db.Records
            .AsNoTracking()
            .Where(r => r.ExpiryDate != null && r.ExpiryDate > DateOnly.FromDateTime(now))
            .ToListAsync(token);

        var tenantRuleMap = await db.CourseRules.AsNoTracking().ToListAsync(token);

        foreach (var record in candidates)
        {
            if (IsOneTime(record, tenantRuleMap))
            {
                continue;
            }

            foreach (var lead in _options.LeadDays)
            {
                // Ensure we store UTC DateTimes for Postgres timestamp with time zone
                var expiryUtc = DateTime.SpecifyKind(
                    record.ExpiryDate!.Value.ToDateTime(TimeOnly.MinValue),
                    DateTimeKind.Utc);
                var scheduledFor = expiryUtc.AddDays(-lead);
                if (scheduledFor <= now)
                {
                    continue;
                }

                var exists = await db.Reminders.AnyAsync(r => r.RecordId == record.Id && r.ScheduledFor == scheduledFor, token);
                if (!exists)
                {
                    db.Reminders.Add(new Reminder
                    {
                        Id = Guid.NewGuid(),
                        TenantId = record.TenantId,
                        RecordId = record.Id,
                        Type = ReminderType.Expiry,
                        ScheduledFor = scheduledFor,
                        CreatedAt = now
                    });
                }
            }
        }

        await db.SaveChangesAsync(token);
    }

    private static bool IsOneTime(Record record, IEnumerable<CourseRule> rules)
    {
        var tenantMatch = rules.FirstOrDefault(r => r.TenantId == record.TenantId && r.CourseName == record.CourseName);
        if (tenantMatch is not null)
        {
            return tenantMatch.IsOneTime;
        }

        var globalMatch = rules.FirstOrDefault(r => r.TenantId == null && r.CourseName == record.CourseName);
        return globalMatch?.IsOneTime ?? false;
    }
}
