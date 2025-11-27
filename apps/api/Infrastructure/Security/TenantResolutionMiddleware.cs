using System.Security.Claims;
using CertiWatch.Contracts.Tenancy;
using CertiWatch.Api.Configuration;
using CertiWatch.Api.Features.Auth;
using Microsoft.Extensions.Options;

namespace CertiWatch.Api.Infrastructure.Security;

public sealed class TenantResolutionMiddleware(RequestDelegate next, IOptions<MagicLinkOptions> magicOptions)
{
    public async Task InvokeAsync(HttpContext context, ITenantContextAccessor accessor)
    {
        var sessionToken = context.Request.Cookies["cw_session"];
        Guid? magicTenant = null;
        string? magicEmail = null;

        if (!string.IsNullOrWhiteSpace(sessionToken))
        {
            var payload = MagicLinkTokenService.ValidateToken(sessionToken, magicOptions.Value.Secret);
            if (payload is not null && payload.Value.Purpose == "session")
            {
                var deviceCookie = context.Request.Cookies["cw_device"];
                if (string.IsNullOrWhiteSpace(payload.Value.DeviceId))
                {
                    magicTenant = payload.Value.TenantId;
                    magicEmail = payload.Value.Email;
                }
                else if (payload.Value.DeviceId == deviceCookie)
                {
                    magicTenant = payload.Value.TenantId;
                    magicEmail = payload.Value.Email;
                }
            }
        }

        var tenantId = magicTenant ?? ResolveTenantId(context);
        var userId = ResolveUserId(context);
        var email = magicEmail ?? context.User?.Identity?.Name ?? context.Request.Headers["X-Admin-Email"].FirstOrDefault() ?? "admin@certiwatch.local";
        var role = context.User?.Claims.FirstOrDefault(c => c.Type == ClaimTypes.Role)?.Value ?? "admin";

        accessor.Set(new TenantContext
        {
            TenantId = tenantId,
            UserId = userId,
            Email = email,
            Role = role
        });

        await next(context);
    }

    private static Guid ResolveTenantId(HttpContext context)
    {
        if (context.Request.Headers.TryGetValue("X-Tenant-Id", out var header) && Guid.TryParse(header, out var tenantId))
        {
            return tenantId;
        }

        var claim = context.User?.Claims.FirstOrDefault(c => c.Type == "tenant_id")?.Value;
        return Guid.TryParse(claim, out var claimTenant)
            ? claimTenant
            : Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    }

    private static Guid ResolveUserId(HttpContext context)
    {
        var claim = context.User?.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier)?.Value;
        if (Guid.TryParse(claim, out var guid))
        {
            return guid;
        }

        return Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    }
}
