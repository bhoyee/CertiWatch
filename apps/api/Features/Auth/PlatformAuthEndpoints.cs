using CertiWatch.Api.Configuration;
using CertiWatch.Api.Infrastructure.Emails;
using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Infrastructure.Security;
using CertiWatch.Api.Infrastructure.Services;
using CertiWatch.Contracts.Responses;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace CertiWatch.Api.Features.Auth;

public static class PlatformAuthEndpoints
{
    public static IEndpointRouteBuilder MapPlatformAuthEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/platform/auth");
        group.MapPost("/magic-link", SendPlatformMagicLinkAsync).AllowAnonymous();
        group.MapGet("/magic-link/verify", VerifyPlatformMagicLinkAsync).AllowAnonymous();
        return routes;
    }

    private sealed record PlatformMagicLinkRequest(string Email);

    private static async Task<IResult> SendPlatformMagicLinkAsync(
        PlatformMagicLinkRequest request,
        IOptions<MagicLinkOptions> magicOptions,
        IEmailTemplateRenderer renderer,
        IEmailService emailService,
        AppDbContext db,
        CancellationToken token)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var user = await db.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Email.ToLower() == email && u.Role.ToLower() == "superadmin", token);
        if (user is null)
        {
            return Results.BadRequest(new { error = "superadmin_not_found" });
        }

        var options = magicOptions.Value;
        var magicToken = MagicLinkTokenService.CreateToken(
            user.Email,
            Guid.Empty,
            options.Secret,
            TimeSpan.FromMinutes(options.ExpiryMinutes),
            purpose: "platform_magic",
            role: "superadmin");

        var link = $"{options.BaseUrl.TrimEnd('/')}/platform/magic?token={magicToken}";
        var html = renderer.RenderMagicLink(user.Email, link);
        await emailService.SendAsync(user.Email, "Your CertiWatch platform login link", html, token);
        return Results.Ok(new { success = true });
    }

    private static async Task<IResult> VerifyPlatformMagicLinkAsync(
        string token,
        IOptions<MagicLinkOptions> magicOptions,
        AppDbContext db,
        CancellationToken cancellationToken)
    {
        var options = magicOptions.Value;
        var payload = MagicLinkTokenService.ValidateToken(token, options.Secret);
        if (payload is null || payload.Value.Purpose != "platform_magic")
        {
            return Results.BadRequest(new { error = "invalid_or_expired" });
        }

        var user = await db.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Email == payload.Value.Email && u.Role.ToLower() == "superadmin", cancellationToken);
        if (user is null || user.IsDisabled)
        {
            return Results.BadRequest(new { error = "invalid_or_expired" });
        }

        var sessionLifetime = TimeSpan.FromDays(options.LongSessionDays);
        var sessionToken = MagicLinkTokenService.CreateToken(
            user.Email,
            Guid.Empty,
            options.Secret,
            sessionLifetime,
            purpose: "session",
            rememberDevice: true,
            role: "superadmin");

        var expiresAt = DateTimeOffset.UtcNow.Add(sessionLifetime);
        return Results.Ok(new MagicLinkVerifyResponse(user.Email, user.TenantId, sessionToken, expiresAt, null));
    }
}
