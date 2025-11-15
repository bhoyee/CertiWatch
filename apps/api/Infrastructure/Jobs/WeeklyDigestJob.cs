using CertiWatch.Api.Configuration;
using CertiWatch.Api.Infrastructure.Emails;
using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Infrastructure.Services;
using CertiWatch.Contracts.Dtos;
using CertiWatch.Contracts.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using NodaTime;

namespace CertiWatch.Api.Infrastructure.Jobs;

public sealed class WeeklyDigestJob : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IEmailTemplateRenderer _renderer;
    private readonly IEmailService _emailService;
    private readonly ReminderOptions _options;
    private readonly ILogger<WeeklyDigestJob> _logger;

    public WeeklyDigestJob(
        IServiceScopeFactory scopeFactory,
        IEmailTemplateRenderer renderer,
        IEmailService emailService,
        IOptions<ReminderOptions> options,
        ILogger<WeeklyDigestJob> logger)
    {
        _scopeFactory = scopeFactory;
        _renderer = renderer;
        _emailService = emailService;
        _options = options.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(TimeSpan.FromMinutes(30), stoppingToken);
                if (ShouldRunNow())
                {
                    await SendDigestsAsync(stoppingToken);
                }
            }
            catch (TaskCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Weekly digest job failed");
            }
        }
    }

    private bool ShouldRunNow()
    {
        var tz = DateTimeZoneProviders.Tzdb.GetZoneOrNull(_options.DigestTimeZone) ?? DateTimeZoneProviders.Tzdb["Europe/London"];
        var now = SystemClock.Instance.GetCurrentInstant().InZone(tz);
        return now.DayOfWeek == IsoDayOfWeek.Monday &&
               now.TimeOfDay.Hour == _options.DigestTime.Hour &&
               now.TimeOfDay.Minute >= _options.DigestTime.Minute;
    }

    private async Task SendDigestsAsync(CancellationToken token)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var tenants = await db.Tenants.AsNoTracking().Include(t => t.Users).ToListAsync(token);
        foreach (var tenant in tenants)
        {
            var records = await db.Records.AsNoTracking().Where(r => r.TenantId == tenant.Id).ToListAsync(token);
            var digest = new TenantDigestDto(
                tenant.Id,
                tenant.Name,
                records.Where(r => r.CreatedAt >= DateTime.UtcNow.AddDays(-7)).Select(ToDto).ToList(),
                records.Where(r => r.ExpiryDate != null && r.ExpiryDate <= DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30))).Select(ToDto).ToList(),
                records.Where(r => r.ExpiryDate != null && r.ExpiryDate < DateOnly.FromDateTime(DateTime.UtcNow)).Select(ToDto).ToList(),
                records.Where(r => r.Confidence < 0.6m).Select(ToDto).ToList());

            var html = _renderer.RenderDigest(digest);
            var adminEmail = tenant.Users.FirstOrDefault()?.Email ?? "admin@tenant.local";
            await _emailService.SendAsync(adminEmail, $"CertiWatch Weekly Digest - {tenant.Name}", html, token);
        }
    }

    private static RecordDto ToDto(CertiWatch.Api.Domain.Entities.Record record)
        => new(
            record.Id,
            record.TenantId,
            record.DocumentId,
            record.StaffName,
            record.CourseName,
            record.Issuer,
            record.IssueDate,
            record.ExpiryDate,
            record.ExpiryDerived,
            record.Confidence,
            record.Confidence > 0.8m ? RecordConfidenceBand.High : record.Confidence > 0.6m ? RecordConfidenceBand.Medium : RecordConfidenceBand.Low,
            record.ProcessingStatus,
            new Dictionary<string, string>(),
            record.CreatedAt,
            record.UpdatedAt);
}
