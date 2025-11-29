using System.Security.Cryptography;
using CertiWatch.Api.Configuration;
using CertiWatch.Api.Domain.Entities;
using CertiWatch.Api.Features.Auth;
using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Infrastructure.Security;
using CertiWatch.Api.Infrastructure.Services;
using CertiWatch.Contracts.Enums;
using CertiWatch.Contracts.Events;
using CertiWatch.Contracts.Requests;
using CertiWatch.Contracts.Responses;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace CertiWatch.Api.Features.Uploads;

public static class UploadEndpoints
{
    private const string UploadSourceName = "Upload Portal";
    private const string UploadDeviceToken = "upload-portal";

    public static IEndpointRouteBuilder MapUploadEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/uploads");
        group.WithMetadata(new IgnoreAntiforgeryTokenAttribute());
        group.DisableAntiforgery();
        group.MapPost("/requests", CreateRequestAsync).RequireAuthorization();
        group.MapGet("/history", HistoryAsync).RequireAuthorization();
        group.MapGet("/{token}", ValidateAsync).AllowAnonymous();
        group.MapPost("/{token}/file", UploadFileAsync).AllowAnonymous();
        return group;
    }

    private static async Task<IResult> CreateRequestAsync(
        CreateUploadRequest request,
        AppDbContext db,
        ITenantContextAccessor accessor,
        IOptions<MagicLinkOptions> magicOptions,
        IDateTimeProvider clock,
        IEmailService emailService,
        CancellationToken token)
    {
        if (!string.Equals(accessor.Current.Role, "admin", StringComparison.OrdinalIgnoreCase))
        {
            return Results.Forbid();
        }

        var tenantId = accessor.Current.TenantId;
        var expiresAt = clock.UtcNow.AddHours(24);
        var rawToken = GenerateToken();
        var entity = new UploadRequest
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Token = rawToken,
            StaffName = request.StaffName,
            StaffEmail = request.StaffEmail,
            CourseName = request.CourseName,
            ExpiryHint = request.ExpiryDate,
            ExpiresAt = expiresAt,
            Status = UploadStatus.Pending,
            CreatedAt = clock.UtcNow
        };
        db.UploadRequests.Add(entity);
        await db.SaveChangesAsync(token);

        var baseUrl = magicOptions.Value.BaseUrl.TrimEnd('/');
        var link = $"{baseUrl}/upload?token={rawToken}";

        if (!string.IsNullOrWhiteSpace(request.StaffEmail))
        {
            var html = $"""
                <p>Hello{(string.IsNullOrWhiteSpace(request.StaffName) ? "" : $" {request.StaffName}")},</p>
                <p>You have been invited to upload your certificate.</p>
                <p>This link expires at {expiresAt:u}:</p>
                <p><a href="{link}">{link}</a></p>
                <p>If you did not expect this, please ignore this email.</p>
            """;
            await emailService.SendAsync(request.StaffEmail!, "Upload your certificate", html, token);
        }

        return Results.Ok(new UploadLinkResponse(rawToken, link, expiresAt));
    }

    private static async Task<IResult> HistoryAsync(AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        var tenantId = accessor.Current.TenantId;
        var items = await db.UploadRequests.AsNoTracking()
            .Where(u => u.TenantId == tenantId)
            .OrderByDescending(u => u.CreatedAt)
            .Take(50)
            .ToListAsync(token);

        return Results.Ok(items.Select(u => new
        {
            u.Id,
            u.StaffName,
            u.StaffEmail,
            u.CourseName,
            u.ExpiryHint,
            u.Status,
            u.CreatedAt,
            u.UsedAt,
            u.ExpiresAt
        }));
    }

    private static async Task<IResult> ValidateAsync([FromRoute(Name = "token")] string tokenValue, AppDbContext db, IDateTimeProvider clock, CancellationToken token)
    {
        var req = await db.UploadRequests.AsNoTracking().FirstOrDefaultAsync(u => u.Token == tokenValue, token);
        if (req is null || req.ExpiresAt < clock.UtcNow)
        {
            return Results.BadRequest(new { error = "invalid_or_expired" });
        }

        return Results.Ok(new
        {
            req.StaffName,
            req.StaffEmail,
            req.CourseName,
            req.ExpiryHint,
            req.ExpiresAt
        });
    }

    private static async Task<IResult> UploadFileAsync(
        [FromRoute(Name = "token")] string tokenValue,
        [FromForm] UploadFileForm form,
        AppDbContext db,
        ITenantContextAccessor accessor,
        IDateTimeProvider clock,
        IIngestionQueue queue,
        CancellationToken token)
    {
        var req = await db.UploadRequests.FirstOrDefaultAsync(u => u.Token == tokenValue, token);
        if (req is null || req.ExpiresAt < clock.UtcNow)
        {
            return Results.BadRequest(new { error = "invalid_or_expired" });
        }

        var tenantId = req.TenantId;
        var source = await EnsureUploadSourceAsync(db, tenantId, clock, token);
        if (form.Files is null || form.Files.Count == 0)
        {
            return Results.BadRequest(new { error = "no_files" });
        }

        var uploadDir = Path.Combine("/uploads", tenantId.ToString(), req.Id.ToString("N"));
        Directory.CreateDirectory(uploadDir);
        var fields = new Dictionary<string, string>();
        if (!string.IsNullOrWhiteSpace(req.StaffName)) fields["staff_name"] = req.StaffName!;
        if (req.ExpiryHint.HasValue) fields["expiry_date"] = req.ExpiryHint.Value.ToString("yyyy-MM-dd");

        foreach (var file in form.Files)
        {
            var fileName = Path.GetFileName(file.FileName);
            var destPath = Path.Combine(uploadDir, fileName);
            await using (var stream = File.Create(destPath))
            {
                await file.CopyToAsync(stream, token);
            }

            var fileHash = ComputeHash(destPath);
            var size = new FileInfo(destPath).Length;

            await queue.EnqueueAsync(new DocumentDetectedEvent(
                tenantId,
                source.Id,
                UploadDeviceToken,
                fileName,
                destPath,
                fileHash,
                file.ContentType ?? "application/octet-stream",
                size,
                Array.Empty<string>(),
                fields,
                Contracts.Enums.ProcessingStatus.Pending,
                clock.UtcNow), token);
        }

        req.Status = UploadStatus.Pending;
        req.FilePath = destPath;
        req.OriginalFileName = fileName;
        req.UsedAt = clock.UtcNow;
        await db.SaveChangesAsync(token);

        return Results.Ok(new { success = true });
    }

    private static async Task<Source> EnsureUploadSourceAsync(AppDbContext db, Guid tenantId, IDateTimeProvider clock, CancellationToken token)
    {
        var existing = await db.Sources.FirstOrDefaultAsync(s => s.TenantId == tenantId && s.DisplayName == UploadSourceName, token);
        if (existing is not null) return existing;

        var src = new Source
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            DisplayName = UploadSourceName,
            Type = SourceType.Local,
            ConfigJson = "{}",
            CreatedAt = clock.UtcNow
        };
        db.Sources.Add(src);
        await db.SaveChangesAsync(token);
        return src;
    }

    private static string GenerateToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToBase64String(bytes).Replace("+", "-").Replace("/", "_").TrimEnd('=');
    }

    private static string ComputeHash(string path)
    {
        using var sha = SHA256.Create();
        using var stream = File.OpenRead(path);
        var hash = sha.ComputeHash(stream);
        return BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant();
    }
}

public sealed record CreateUploadRequest(string? StaffName, string? StaffEmail, string? CourseName, DateOnly? ExpiryDate);

public sealed record UploadFileForm(List<IFormFile> Files);
