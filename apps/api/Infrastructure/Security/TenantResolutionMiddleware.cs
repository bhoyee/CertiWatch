using System.Security.Claims;
using CertiWatch.Contracts.Tenancy;
using CertiWatch.Api.Configuration;
using CertiWatch.Api.Features.Auth;
using CertiWatch.Api.Infrastructure.Persistence;
using Microsoft.Extensions.Options;
using Microsoft.EntityFrameworkCore;

namespace CertiWatch.Api.Infrastructure.Security;

public sealed class TenantResolutionMiddleware(RequestDelegate next, IOptions<MagicLinkOptions> magicOptions)
{
    public async Task InvokeAsync(HttpContext context, ITenantContextAccessor accessor, AppDbContext db)
    {
        var sessionToken = context.Request.Cookies["cw_session"];
        Guid? magicTenant = null;
        string? magicEmail = null;
        string? roleFromUser = null;

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

        if (!string.IsNullOrWhiteSpace(email))
        {
            var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Email == email && u.TenantId == tenantId);
            if (user is not null)
            {
                roleFromUser = user.Role;
                userId = user.Id;
            }
        }

        accessor.Set(new TenantContext
        {
            TenantId = tenantId,
            UserId = userId,
            Email = email,
            Role = roleFromUser ?? role
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
