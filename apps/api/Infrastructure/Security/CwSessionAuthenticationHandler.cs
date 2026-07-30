using System.Security.Claims;
using System.Text.Encodings.Web;
using CertiWatch.Api.Configuration;
using CertiWatch.Api.Features.Auth;
using CertiWatch.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace CertiWatch.Api.Infrastructure.Security;

public static class CwSessionAuthenticationDefaults
{
    public const string Scheme = "CwSession";
}

public sealed class CwSessionAuthenticationOptions : AuthenticationSchemeOptions;

// Validates the existing cw_session HMAC token (see MagicLinkTokenService) and turns it into a
// real ClaimsPrincipal. Replaces the old TenantResolutionMiddleware behavior of silently falling
// back to an admin identity for tenant "aaaaaaaa-..." whenever no/invalid session was presented.
public sealed class CwSessionAuthenticationHandler(
    IOptionsMonitor<CwSessionAuthenticationOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    IOptions<MagicLinkOptions> magicLinkOptions,
    AppDbContext db)
    : AuthenticationHandler<CwSessionAuthenticationOptions>(options, logger, encoder)
{
    private const string FailReasonItemKey = "cw_auth_fail_reason";

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var sessionToken = Request.Cookies["cw_session"];
        if (string.IsNullOrWhiteSpace(sessionToken))
        {
            return AuthenticateResult.NoResult();
        }

        var payload = MagicLinkTokenService.ValidateToken(sessionToken, magicLinkOptions.Value.Secret);
        if (payload is null || payload.Value.Purpose != "session")
        {
            return AuthenticateResult.NoResult();
        }

        if (!string.IsNullOrWhiteSpace(payload.Value.DeviceId))
        {
            var deviceCookie = Request.Cookies["cw_device"];
            if (payload.Value.DeviceId != deviceCookie)
            {
                return AuthenticateResult.NoResult();
            }
        }

        var isSuper = string.Equals(payload.Value.Role, "superadmin", StringComparison.OrdinalIgnoreCase);
        var userQuery = db.Users.AsNoTracking().Where(u => u.Email == payload.Value.Email);
        userQuery = isSuper
            ? userQuery.Where(u => u.Role.ToLower() == "superadmin")
            : userQuery.Where(u => u.TenantId == payload.Value.TenantId);

        var user = await userQuery.FirstOrDefaultAsync();
        if (user is null)
        {
            Context.Items[FailReasonItemKey] = isSuper ? "superadmin_not_found" : "session_user_not_found";
            return AuthenticateResult.NoResult();
        }

        if (user.IsDisabled)
        {
            Context.Items[FailReasonItemKey] = "user_disabled";
            return AuthenticateResult.NoResult();
        }

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Role, isSuper ? "superadmin" : user.Role),
            new Claim("tenant_id", (isSuper ? Guid.Empty : user.TenantId).ToString())
        };

        var identity = new ClaimsIdentity(claims, CwSessionAuthenticationDefaults.Scheme);
        var ticket = new AuthenticationTicket(new ClaimsPrincipal(identity), CwSessionAuthenticationDefaults.Scheme);
        return AuthenticateResult.Success(ticket);
    }

    protected override Task HandleChallengeAsync(AuthenticationProperties properties)
    {
        var reason = Context.Items.TryGetValue(FailReasonItemKey, out var value) ? value as string : null;
        Response.StatusCode = reason switch
        {
            "user_disabled" => StatusCodes.Status403Forbidden,
            "superadmin_not_found" => StatusCodes.Status403Forbidden,
            _ => StatusCodes.Status401Unauthorized
        };

        return Response.WriteAsync(reason ?? "unauthorized");
    }
}
