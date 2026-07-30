using System.Security.Cryptography;
using CertiWatch.Api.Domain.Entities;
using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Infrastructure.Security;
using CertiWatch.Api.Infrastructure.Services;
using CertiWatch.Contracts.Events;
using CertiWatch.Contracts.Requests;
using CertiWatch.Contracts.Responses;
using Microsoft.EntityFrameworkCore;

namespace CertiWatch.Api.Features.Devices;

public static class DeviceEndpoints
{
    public static IEndpointRouteBuilder MapDeviceEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/devices");
        group.MapGet(string.Empty, ListAsync).RequireAuthorization();
        group.MapPost("/enrollment-codes", CreateEnrollmentCodeAsync).RequireAuthorization("Admin");
        group.MapPost("/enroll", EnrollAsync).AllowAnonymous();
        group.MapPost("/heartbeat", HeartbeatAsync).AllowAnonymous();
        group.MapPost("/events", EventsAsync).AllowAnonymous();
        group.MapPost("/check-hash", CheckHashAsync).AllowAnonymous();
        group.MapGet("/{deviceId:guid}/sources", ListSourcesForDeviceAsync).AllowAnonymous();
        group.MapPost("/{deviceId:guid}/sources/{sourceId:guid}/sync-status", UpdateSourceSyncStatusAsync).AllowAnonymous();
        return group;
    }

    private static async Task<IResult> ListAsync(AppDbContext db, ITenantContextAccessor tenantAccessor, CancellationToken token)
    {
        if (!RecordVisibility.IsAdmin(tenantAccessor))
        {
            return Results.Forbid();
        }

        var tenantId = tenantAccessor.Current.TenantId;
        var devices = await db.Devices.AsNoTracking().Where(d => d.TenantId == tenantId).ToListAsync(token);
        return Results.Ok(devices.Select(d => new
        {
            d.Id,
            d.Name,
            d.OperatingSystem,
            d.Status,
            d.LastSeenAt
        }));
    }

    private static async Task<IResult> CreateEnrollmentCodeAsync(
        AppDbContext db,
        ITenantContextAccessor tenantAccessor,
        IDateTimeProvider clock,
        CancellationToken token)
    {
        var tenantId = tenantAccessor.Current.TenantId;

        var activeCodes = await db.DeviceEnrollmentCodes
            .Where(c => c.TenantId == tenantId && c.RevokedAt == null)
            .ToListAsync(token);
        foreach (var existing in activeCodes)
        {
            existing.RevokedAt = clock.UtcNow;
        }

        var plaintext = DeviceSecrets.GenerateEnrollmentCode();
        var enrollmentCode = new DeviceEnrollmentCode
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CodeHash = DeviceSecrets.Hash(plaintext),
            ExpiresAt = clock.UtcNow.AddHours(24),
            CreatedAt = clock.UtcNow
        };
        db.DeviceEnrollmentCodes.Add(enrollmentCode);
        await db.SaveChangesAsync(token);

        return Results.Ok(new DeviceEnrollmentCodeResponse(plaintext, enrollmentCode.ExpiresAt));
    }

    private static async Task<IResult> EnrollAsync(EnrollDeviceRequest request, AppDbContext db, IDateTimeProvider clock, CancellationToken token)
    {
        var codeHash = DeviceSecrets.Hash(request.EnrollmentCode);
        var enrollmentCode = await db.DeviceEnrollmentCodes
            .Where(c => c.CodeHash == codeHash && c.RevokedAt == null && c.ExpiresAt > clock.UtcNow)
            .FirstOrDefaultAsync(token);

        if (enrollmentCode is null)
        {
            return Results.Json(new { error = "invalid_enrollment_code" }, statusCode: StatusCodes.Status401Unauthorized);
        }

        var device = new Device
        {
            Id = Guid.NewGuid(),
            TenantId = enrollmentCode.TenantId,
            Name = request.DeviceName,
            OperatingSystem = request.OperatingSystem ?? "unknown",
            DeviceToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)),
            Status = Contracts.Enums.DeviceStatus.Enrolled,
            EnrolledAt = clock.UtcNow,
            CreatedAt = clock.UtcNow
        };

        db.Devices.Add(device);
        await db.SaveChangesAsync(token);

        return Results.Ok(new DeviceEnrollmentResponse(device.Id, device.DeviceToken, clock.UtcNow.AddMonths(6)));
    }

    private static async Task<IResult> HeartbeatAsync(DeviceHeartbeatRequest request, AppDbContext db, IDateTimeProvider clock, CancellationToken token)
    {
        var device = await db.Devices.FirstOrDefaultAsync(d => d.Id == request.DeviceId, token);
        if (device is null || !DeviceSecrets.ConstantTimeEquals(device.DeviceToken, request.DeviceToken))
        {
            return Results.Unauthorized();
        }

        device.LastSeenAt = clock.UtcNow;
        await db.SaveChangesAsync(token);
        return Results.Ok(new { status = device.Status.ToString() });
    }

    private static async Task<IResult> EventsAsync(DeviceEventRequest request, AppDbContext db, IIngestionQueue queue, CancellationToken token)
    {
        var device = await db.Devices.AsNoTracking().FirstOrDefaultAsync(d => d.Id == request.DeviceId, token);
        if (device is null || !DeviceSecrets.ConstantTimeEquals(device.DeviceToken, request.DeviceToken))
        {
            return Results.Unauthorized();
        }

        foreach (var doc in request.Documents)
        {
            await queue.EnqueueAsync(doc with { TenantId = device.TenantId }, token);
        }

        return Results.Accepted();
    }

    private static async Task<IResult> CheckHashAsync(FileHashCheckRequest request, AppDbContext db, CancellationToken token)
    {
        var device = await db.Devices.AsNoTracking().FirstOrDefaultAsync(d => d.Id == request.DeviceId, token);
        if (device is null || !DeviceSecrets.ConstantTimeEquals(device.DeviceToken, request.DeviceToken))
        {
            return Results.Unauthorized();
        }

        var record = await db.Records
            .AsNoTracking()
            .Include(r => r.Document)
            .Where(r => r.TenantId == device.TenantId && r.Document!.FileHash == request.FileHash)
            .OrderByDescending(r => r.CreatedAt)
            .FirstOrDefaultAsync(token);

        if (record is null)
        {
            return Results.Ok(new FileHashCheckResponse(false, true));
        }

        var shouldReprocess = HashCheckExtensions.IsIncomplete(record);

        return Results.Ok(new FileHashCheckResponse(true, shouldReprocess));
    }

    private static async Task<IResult> ListSourcesForDeviceAsync(Guid deviceId, string? deviceToken, AppDbContext db, CancellationToken token)
    {
        var device = await db.Devices.AsNoTracking().FirstOrDefaultAsync(d => d.Id == deviceId, token);
        if (device is null)
        {
            return Results.NotFound();
        }

        if (!DeviceSecrets.ConstantTimeEquals(device.DeviceToken, deviceToken))
        {
            return Results.Unauthorized();
        }

        var sources = await db.Sources.AsNoTracking()
            .Where(s => s.TenantId == device.TenantId)
            .ToListAsync(token);

        var sourceIds = sources.Select(s => s.Id).ToList();
        var secrets = await db.SourceSecrets.AsNoTracking()
            .Where(sec => sec.TenantId == device.TenantId && sourceIds.Contains(sec.SourceId))
            .ToListAsync(token);

        var merged = sources.Select(s =>
        {
            var cfg = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, string>>(s.ConfigJson) ?? new Dictionary<string, string>();
            foreach (var sec in secrets.Where(sec => sec.SourceId == s.Id))
            {
                cfg[sec.Key] = sec.Value;
            }
            return new CertiWatch.Contracts.Dtos.SourceDto(
                s.Id,
                s.Type,
                s.DisplayName,
                cfg,
                s.CreatedAt
            );
        });

        return Results.Ok(merged);
    }

    private sealed record SyncStatusRequest(string Status, string? Message);

    private static async Task<IResult> UpdateSourceSyncStatusAsync(Guid deviceId, Guid sourceId, string? deviceToken, SyncStatusRequest request, AppDbContext db, CancellationToken token)
    {
        var device = await db.Devices.FirstOrDefaultAsync(d => d.Id == deviceId, token);
        if (device is null)
        {
            return Results.NotFound();
        }

        if (!DeviceSecrets.ConstantTimeEquals(device.DeviceToken, deviceToken))
        {
            return Results.Unauthorized();
        }

        var source = await db.Sources.FirstOrDefaultAsync(s => s.Id == sourceId && s.TenantId == device.TenantId, token);
        if (source is null)
        {
            return Results.NotFound();
        }

        var cfg = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, string>>(source.ConfigJson) ?? new Dictionary<string, string>();
        cfg["sync_status"] = request.Status;
        cfg["last_sync"] = DateTime.UtcNow.ToString("o");
        if (!string.IsNullOrWhiteSpace(request.Message))
        {
            cfg["sync_error"] = request.Message;
        }
        else
        {
            cfg.Remove("sync_error");
        }

        source.ConfigJson = System.Text.Json.JsonSerializer.Serialize(cfg);
        await db.SaveChangesAsync(token);
        return Results.NoContent();
    }
}

public sealed record FileHashCheckRequest(Guid DeviceId, string DeviceToken, string FileHash);

public sealed record FileHashCheckResponse(bool Exists, bool ShouldReprocess);

public sealed record DeviceEnrollmentCodeResponse(string Code, DateTime ExpiresAt);

internal static class HashCheckExtensions
{
    private static readonly string[] UnknownTokens = { "Unknown", "Unknown Course", "Unknown Staff", "Unknown Issuer", "N/A", "-" };

    public static bool IsIncomplete(Record record)
    {
        bool Missing(string? value) => string.IsNullOrWhiteSpace(value) || UnknownTokens.Any(t => value.Equals(t, StringComparison.OrdinalIgnoreCase));

        var missingRequired =
            Missing(record.StaffName) ||
            Missing(record.CourseName) ||
            Missing(record.Issuer) ||
            record.IssueDate is null;

        var needsReviewMissing = (record.ReviewReason ?? string.Empty).Contains("missing_required", StringComparison.OrdinalIgnoreCase);
        var isNeedsReview = record.ProcessingStatus == CertiWatch.Contracts.Enums.ProcessingStatus.NeedsReview;

        return missingRequired || needsReviewMissing || isNeedsReview;
    }
}
