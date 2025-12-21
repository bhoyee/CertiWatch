using CertiWatch.Api.Configuration;
using CertiWatch.Api.Domain.Entities;
using CertiWatch.Api.Infrastructure.Emails;
using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Infrastructure.Services;
using CertiWatch.Api.Infrastructure.Security;
using CertiWatch.Contracts.Requests;
using CertiWatch.Contracts.Responses;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace CertiWatch.Api.Features.Auth;

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/auth");
        group.MapPost("/magic-link", SendMagicLinkAsync).AllowAnonymous();
        group.MapGet("/magic-link/verify", VerifyMagicLinkAsync).AllowAnonymous();
        group.MapPost("/invite", InviteAdminAsync);
        return routes;
    }

    private static async Task<IResult> SendMagicLinkAsync(
        MagicLinkRequest request,
        IOptions<MagicLinkOptions> magicOptions,
        IEmailTemplateRenderer renderer,
        IEmailService emailService,
        AppDbContext db,
        ITenantContextAccessor tenantAccessor,
        CancellationToken token)
    {
        var tenantId = tenantAccessor.Current.TenantId;
        var existing = await db.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Email == request.Email && u.TenantId == tenantId, token);
        if (existing is null)
        {
            const string message = "We couldn't find that email. Please sign up to start your trial.";
            return Results.Text(message, "text/plain", statusCode: StatusCodes.Status400BadRequest);
        }

        var options = magicOptions.Value;
        var tokenString = MagicLinkTokenService.CreateToken(
            request.Email,
            tenantId,
            options.Secret,
            TimeSpan.FromMinutes(options.ExpiryMinutes),
            purpose: "magic",
            rememberDevice: request.RememberDevice,
            deviceId: request.DeviceId);
        var link = $"{options.BaseUrl.TrimEnd('/')}/magic?token={tokenString}";
        var html = renderer.RenderMagicLink(request.Email, link);
        await emailService.SendAsync(request.Email, "Your CertiWatch login link", html, token);

        if (!string.IsNullOrWhiteSpace(request.FallbackEmail) && !string.Equals(request.FallbackEmail, request.Email, StringComparison.OrdinalIgnoreCase))
        {
            await emailService.SendAsync(request.FallbackEmail!, "Your CertiWatch login link (fallback)", html, token);
        }

        return Results.Ok(new { success = true });
    }

    private static async Task<IResult> VerifyMagicLinkAsync(
        string token,
        IOptions<MagicLinkOptions> magicOptions,
        AppDbContext db,
        CancellationToken cancellationToken)
    {
        var options = magicOptions.Value;
        var payload = MagicLinkTokenService.ValidateToken(token, options.Secret);
        if (payload is null || payload.Value.Purpose != "magic")
        {
            return Results.BadRequest(new { error = "invalid_or_expired" });
        }

        // If the user was deleted (invite removed) after the token was issued, refuse the login.
        var exists = await db.Users.AsNoTracking().AnyAsync(
            u => u.Email == payload.Value.Email && u.TenantId == payload.Value.TenantId,
            cancellationToken);
        if (!exists)
        {
            return Results.BadRequest(new { error = "invalid_or_expired" });
        }

        var sessionLifetime = payload.Value.RememberDevice
            ? TimeSpan.FromDays(options.LongSessionDays)
            : TimeSpan.FromHours(options.ShortSessionHours);

        var sessionToken = MagicLinkTokenService.CreateToken(
            payload.Value.Email,
            payload.Value.TenantId,
            options.Secret,
            sessionLifetime,
            purpose: "session",
            rememberDevice: payload.Value.RememberDevice,
            deviceId: payload.Value.DeviceId);

        var expiresAt = DateTimeOffset.UtcNow.Add(sessionLifetime);
        return Results.Ok(new MagicLinkVerifyResponse(payload.Value.Email, payload.Value.TenantId, sessionToken, expiresAt, payload.Value.DeviceId));
    }

    private static async Task<IResult> InviteAdminAsync(
        InviteUserRequest request,
        IOptions<MagicLinkOptions> magicOptions,
        IEmailTemplateRenderer renderer,
        IEmailService emailService,
        AppDbContext db,
        ITenantContextAccessor tenantAccessor,
        CancellationToken token)
    {
        // If we fell back to the anonymous/default identity, require a real session instead of silently stamping admin.
        var defaultUserId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
        if (tenantAccessor.Current.UserId == defaultUserId &&
            string.Equals(tenantAccessor.Current.Email, "admin@certiwatch.local", StringComparison.OrdinalIgnoreCase))
        {
            return Results.Unauthorized(new { error = "session_required" });
        }

        var isAdmin = string.Equals(tenantAccessor.Current.Role, "admin", StringComparison.OrdinalIgnoreCase);
        var isManager = string.Equals(tenantAccessor.Current.Role, "manager", StringComparison.OrdinalIgnoreCase);
        if (!isAdmin && !isManager)
        {
            return Results.Forbid();
        }

        // Managers may only invite viewers.
        if (isManager && !string.Equals(request.Role, "viewer", StringComparison.OrdinalIgnoreCase))
        {
            return Results.BadRequest(new { error = "managers_can_only_invite_viewers" });
        }

        var tenantId = tenantAccessor.Current.TenantId;
        var invitedBy = tenantAccessor.Current.UserId;
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == request.Email && u.TenantId == tenantId, token);
        if (user is null)
        {
            user = new User
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Email = request.Email,
                Name = string.IsNullOrWhiteSpace(request.Name) ? request.Email : request.Name.Trim(),
                Role = isManager
                    ? "viewer"
                    : string.IsNullOrWhiteSpace(request.Role) ? "admin" : request.Role,
                InvitedByUserId = invitedBy
            };
            db.Users.Add(user);
            await db.SaveChangesAsync(token);
        }
        else
        {
            // Refresh the name/role if a new invite is sent with updated details.
            user.Name = string.IsNullOrWhiteSpace(request.Name) ? user.Name ?? request.Email : request.Name.Trim();
            if (isManager)
            {
                // Re-associate this viewer to the manager sending the invite to ensure scoping works.
                user.Role = "viewer";
                user.InvitedByUserId = invitedBy;
            }
            else if (!string.IsNullOrWhiteSpace(request.Role))
            {
                user.Role = request.Role;
                user.InvitedByUserId ??= invitedBy;
            }
            await db.SaveChangesAsync(token);
        }

        var tenantName = await db.Tenants.AsNoTracking()
            .Where(t => t.Id == tenantId)
            .Select(t => t.Name)
            .FirstOrDefaultAsync(token) ?? "CertiWatch";

        var options = magicOptions.Value;
        var tokenString = MagicLinkTokenService.CreateToken(
            request.Email,
            tenantId,
            options.Secret,
            TimeSpan.FromMinutes(options.ExpiryMinutes),
            purpose: "magic",
            rememberDevice: true,
            deviceId: null);
        var link = $"{options.BaseUrl.TrimEnd('/')}/magic?token={tokenString}";
        var html = renderer.RenderMagicLink(request.Email, link);
        await emailService.SendAsync(request.Email, $"You've been invited to CertiWatch ({tenantName})", html, token);

        return Results.Ok(new { success = true });
    }
}

public sealed record MagicLinkRequest(string Email, string? FallbackEmail, bool RememberDevice, string? DeviceId);

public sealed record InviteUserRequest(string Email, string? Name, string Role);
