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
        string? magicRole = null;
        string? roleFromUser = null;
        var emailFromHeader = context.Request.Headers["X-Admin-Email"].FirstOrDefault();

        if (!string.IsNullOrWhiteSpace(sessionToken))
        {
            var payload = MagicLinkTokenService.ValidateToken(sessionToken, magicOptions.Value.Secret);
            if (payload is not null && payload.Value.Purpose == "session")
            {
                magicRole = payload.Value.Role;
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

        var isSuper = string.Equals(magicRole, "superadmin", StringComparison.OrdinalIgnoreCase);
        var tenantId = isSuper ? Guid.Empty : magicTenant ?? ResolveTenantId(context);
        var userId = ResolveUserId(context);
        var email = magicEmail
                    ?? context.User?.Identity?.Name
                    ?? emailFromHeader
                    ?? (isSuper ? string.Empty : "admin@certiwatch.local");
        var role = magicRole
                   ?? context.User?.Claims.FirstOrDefault(c => c.Type == ClaimTypes.Role)?.Value
                   ?? "admin";

        if (!string.IsNullOrWhiteSpace(email))
        {
            var userQuery = db.Users.AsNoTracking().Where(u => u.Email == email);
            if (isSuper)
            {
                userQuery = userQuery.Where(u => u.Role.ToLower() == "superadmin");
            }
            else
            {
                userQuery = userQuery.Where(u => u.TenantId == tenantId);
            }
            var user = await userQuery.FirstOrDefaultAsync();
            if (user is not null)
            {
                if (user.IsDisabled)
                {
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    await context.Response.WriteAsync("user_disabled");
                    return;
                }
                roleFromUser = user.Role;
                userId = user.Id;
            }
            else if (isSuper)
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsync("superadmin_not_found");
                return;
            }
        }
        else if (isSuper)
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await context.Response.WriteAsync("superadmin_auth_required");
            return;
        }

        accessor.Set(new TenantContext
        {
            TenantId = tenantId,
            UserId = userId,
            Email = email,
            Role = isSuper ? "superadmin" : roleFromUser ?? role
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
