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
        group.MapPost("/enroll", EnrollAsync);
        group.MapPost("/heartbeat", HeartbeatAsync);
        group.MapPost("/events", EventsAsync);
        group.MapPost("/check-hash", CheckHashAsync);
        return group;
    }

    private static async Task<IResult> ListAsync(AppDbContext db, ITenantContextAccessor tenantAccessor, CancellationToken token)
    {
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

    private static async Task<IResult> EnrollAsync(EnrollDeviceRequest request, AppDbContext db, ITenantContextAccessor tenantAccessor, IDateTimeProvider clock, CancellationToken token)
    {
        var tenantId = tenantAccessor.Current.TenantId;
        var tenant = await db.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId, token);
        if (tenant is null)
        {
            tenant = new Tenant
            {
                Id = tenantId,
                Name = request.DeviceName ?? "Local Tenant",
                Plan = "starter",
                CreatedAtUtc = clock.UtcNow
            };

            var adminEmail = tenantAccessor.Current.Email ?? "admin@certiwatch.local";
            tenant.Users.Add(new User
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Email = adminEmail,
                Name = adminEmail,
                Role = "admin"
            });

            db.Tenants.Add(tenant);
            await db.SaveChangesAsync(token);
        }

        var device = new Device
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
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
        if (device is null)
        {
            return Results.NotFound();
        }

        device.LastSeenAt = clock.UtcNow;
        await db.SaveChangesAsync(token);
        return Results.Ok(new { status = device.Status.ToString() });
    }

    private static async Task<IResult> EventsAsync(DeviceEventRequest request, AppDbContext db, IIngestionQueue queue, CancellationToken token)
    {
        var device = await db.Devices.AsNoTracking().FirstOrDefaultAsync(d => d.Id == request.DeviceId, token);
        if (device is null)
        {
            return Results.NotFound();
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
        if (device is null)
        {
            return Results.NotFound();
        }

        var exists = await db.Documents.AsNoTracking()
            .AnyAsync(d => d.TenantId == device.TenantId && d.FileHash == request.FileHash, token);

        return Results.Ok(new FileHashCheckResponse(exists));
    }
}

public sealed record FileHashCheckRequest(Guid DeviceId, string FileHash);

public sealed record FileHashCheckResponse(bool Exists);
