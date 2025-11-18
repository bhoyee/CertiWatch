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
            var user = new User
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Email = request.Email,
                Name = request.Email,
                Role = "admin"
            };
            db.Users.Add(user);
            await db.SaveChangesAsync(token);
        }

        var options = magicOptions.Value;
        var tokenString = MagicLinkTokenService.CreateToken(request.Email, tenantId, options.Secret, TimeSpan.FromMinutes(options.ExpiryMinutes));
        var link = $"{options.BaseUrl.TrimEnd('/')}/magic?token={tokenString}";
        var html = renderer.RenderMagicLink(request.Email, link);
        await emailService.SendAsync(request.Email, "Your CertiWatch login link", html, token);

        return Results.Ok(new { success = true });
    }

    private static IResult VerifyMagicLinkAsync(
        string token,
        IOptions<MagicLinkOptions> magicOptions)
    {
        var options = magicOptions.Value;
        var payload = MagicLinkTokenService.ValidateToken(token, options.Secret);
        if (payload is null)
        {
            return Results.BadRequest(new { error = "invalid_or_expired" });
        }

        return Results.Ok(new MagicLinkVerifyResponse(payload.Value.Email, payload.Value.TenantId));
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
        var tenantId = tenantAccessor.Current.TenantId;
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == request.Email && u.TenantId == tenantId, token);
        if (user is null)
        {
            user = new User
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Email = request.Email,
                Name = request.Email,
                Role = string.IsNullOrWhiteSpace(request.Role) ? "admin" : request.Role
            };
            db.Users.Add(user);
            await db.SaveChangesAsync(token);
        }

        var options = magicOptions.Value;
        var tokenString = MagicLinkTokenService.CreateToken(request.Email, tenantId, options.Secret, TimeSpan.FromMinutes(options.ExpiryMinutes));
        var link = $"{options.BaseUrl.TrimEnd('/')}/magic?token={tokenString}";
        var html = renderer.RenderMagicLink(request.Email, link);
        await emailService.SendAsync(request.Email, $"You've been invited to CertiWatch ({tenantId})", html, token);

        return Results.Ok(new { success = true });
    }
}

public sealed record MagicLinkRequest(string Email);

public sealed record InviteUserRequest(string Email, string Role);
