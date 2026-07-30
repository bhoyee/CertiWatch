using System.Security.Claims;
using CertiWatch.Contracts.Tenancy;

namespace CertiWatch.Api.Infrastructure.Security;

// Runs after UseAuthentication/UseAuthorization: by the time this middleware executes, ASP.NET has
// already rejected any request that required authentication but didn't have one (via
// CwSessionAuthenticationHandler). This middleware's only job is to copy the already-verified
// claims into the ambient ITenantContextAccessor that the rest of the app reads from.
public sealed class TenantResolutionMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, ITenantContextAccessor accessor)
    {
        if (context.User?.Identity?.IsAuthenticated == true)
        {
            var tenantClaim = context.User.Claims.FirstOrDefault(c => c.Type == "tenant_id")?.Value;
            var userClaim = context.User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier)?.Value;
            var role = context.User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.Role)?.Value ?? string.Empty;
            var email = context.User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.Email)?.Value
                        ?? context.User.Identity.Name
                        ?? string.Empty;

            accessor.Set(new TenantContext
            {
                TenantId = Guid.TryParse(tenantClaim, out var tenantId) ? tenantId : Guid.Empty,
                UserId = Guid.TryParse(userClaim, out var userId) ? userId : Guid.Empty,
                Email = email,
                Role = role
            });
        }

        await next(context);
    }
}
