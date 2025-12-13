using System.Text.Json;
using CertiWatch.Api.Configuration;
using CertiWatch.Api.Features.Auth;
using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Infrastructure.Security;
using CertiWatch.Api.Infrastructure.Services;
using CertiWatch.Api.Infrastructure.Emails;
using CertiWatch.Contracts.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace CertiWatch.Api.Features.Review;

public static class ReviewEndpoints
{
    public static IEndpointRouteBuilder MapReviewEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/review");
        group.MapPost("/{id:guid}/magic-link", CreateMagicLinkAsync).RequireAuthorization();
        group.MapGet("/{id:guid}/{action}", ExecuteMagicLinkAsync).AllowAnonymous();
        return group;
    }

    private sealed record MagicLinkRequest(string Action, bool SendEmail = false, string? Email = null);

    private static async Task<IResult> CreateMagicLinkAsync(
        Guid id,
        [FromBody] MagicLinkRequest request,
        AppDbContext db,
        ITenantContextAccessor accessor,
        IOptions<MagicLinkOptions> magicOptions,
        IEmailService emailService,
        IEmailTemplateRenderer renderer,
        CancellationToken token)
    {
        var action = (request.Action ?? string.Empty).Trim().ToLowerInvariant();
        if (!IsSupportedAction(action))
        {
            return Results.BadRequest("Unsupported action");
        }

        var record = await db.Records.AsNoTracking().FirstOrDefaultAsync(r => r.Id == id && r.TenantId == accessor.Current.TenantId, token);
        if (record is null)
        {
            return Results.NotFound();
        }

        var options = magicOptions.Value;
        var secret = options.Secret;
        var lifetime = TimeSpan.FromMinutes(options.ExpiryMinutes);
        var tokenString = MagicLinkTokenService.CreateToken(
            accessor.Current.Email ?? "admin@certiwatch.local",
            accessor.Current.TenantId,
            secret,
            lifetime,
            purpose: $"review:{action}:{id}");

        var baseUrl = options.BaseUrl.TrimEnd('/');
        var link = $"{baseUrl}/api/review/{id}/{action}?token={tokenString}";

        if (request.SendEmail)
        {
            var to = string.IsNullOrWhiteSpace(request.Email) ? accessor.Current.Email ?? string.Empty : request.Email!;
            if (string.IsNullOrWhiteSpace(to))
            {
                return Results.BadRequest(new { error = "No recipient email available" });
            }

            var body = renderer.RenderMagicLink(to, link);
            await emailService.SendAsync(to, $"Review link: {action} record", body, token);
            return Results.Ok(new { link, emailed = true, to });
        }

        return Results.Ok(new { link, emailed = false });
    }

    private static async Task<IResult> ExecuteMagicLinkAsync(
        Guid id,
        string action,
        [FromQuery] string token,
        AppDbContext db,
        IOptions<MagicLinkOptions> magicOptions,
        IDateTimeProvider clock,
        CancellationToken ct)
    {
        var options = magicOptions.Value;
        var payload = MagicLinkTokenService.ValidateToken(token, options.Secret);
        var expectedPurpose = $"review:{action.ToLowerInvariant()}:{id}";
        if (payload is null || payload.Value.Purpose != expectedPurpose)
        {
            return Results.Unauthorized();
        }

        action = action.Trim().ToLowerInvariant();
        if (!IsSupportedAction(action))
        {
            return Results.BadRequest("Unsupported action");
        }

        var record = await db.Records.FirstOrDefaultAsync(r => r.Id == id && r.TenantId == payload.Value.TenantId, ct);
        if (record is null)
        {
            return Results.NotFound();
        }

        switch (action)
        {
            case "approve":
                record.ProcessingStatus = ProcessingStatus.Ok;
                record.ReviewNotes = AppendNote(record.ReviewNotes, "Approved via magic link");
                break;
            case "ignore":
                record.ProcessingStatus = ProcessingStatus.Ok;
                record.ReviewNotes = AppendNote(record.ReviewNotes, "Ignored via magic link");
                break;
            case "fix":
                record.ProcessingStatus = ProcessingStatus.NeedsReview;
                record.ReviewNotes = AppendNote(record.ReviewNotes, "Needs fixes via magic link");
                break;
        }

        record.ReviewedAt = clock.UtcNow;
        record.ReviewedBy = record.ReviewedBy ?? payload.Value.TenantId;
        record.UpdatedAt = clock.UtcNow;

        db.AuditLogs.Add(new Domain.Entities.AuditLog
        {
            Id = Guid.NewGuid(),
            TenantId = payload.Value.TenantId,
            ActorId = payload.Value.TenantId,
            Action = "record.review.magic",
            MetaJson = JsonSerializer.Serialize(new { recordId = id, action }),
            CreatedAt = clock.UtcNow
        });

        await db.SaveChangesAsync(ct);
        return Results.Ok(new { status = record.ProcessingStatus, message = $"Record {action}d" });
    }

    private static bool IsSupportedAction(string action) =>
        action is "approve" or "ignore" or "fix";

    private static string AppendNote(string? existing, string addition)
    {
        if (string.IsNullOrWhiteSpace(existing)) return addition;
        return $"{existing} | {addition}";
    }
}
