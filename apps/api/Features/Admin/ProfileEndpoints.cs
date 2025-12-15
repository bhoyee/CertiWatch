using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;

namespace CertiWatch.Api.Features.Admin;

public static class ProfileEndpoints
{
    public static IEndpointRouteBuilder MapProfileEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/profile").RequireAuthorization();
        group.MapGet(string.Empty, GetAsync);
        group.MapPatch(string.Empty, UpdateAsync);
        return routes;
    }

    private sealed record ProfileDto(string Email, string? Name, string Role, string TenantName);

    private sealed record UpdateProfileRequest(string Name);

    private static async Task<IResult> GetAsync(AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        var tenantId = accessor.Current.TenantId;
        var email = accessor.Current.Email;
        if (email is null)
        {
            return Results.Unauthorized();
        }

        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.TenantId == tenantId && u.Email == email, token);
        if (user is null)
        {
            return Results.NotFound();
        }

        var tenantName = await db.Tenants.AsNoTracking()
            .Where(t => t.Id == tenantId)
            .Select(t => t.Name)
            .FirstOrDefaultAsync(token) ?? "Tenant";

        return Results.Ok(new ProfileDto(user.Email, user.Name, user.Role, tenantName));
    }

    private static async Task<IResult> UpdateAsync(UpdateProfileRequest request, AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        var tenantId = accessor.Current.TenantId;
        var email = accessor.Current.Email;
        if (email is null)
        {
            return Results.Unauthorized();
        }

        if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Length < 2)
        {
            return Results.BadRequest(new { error = "name_invalid" });
        }

        var user = await db.Users.FirstOrDefaultAsync(u => u.TenantId == tenantId && u.Email == email, token);
        if (user is null)
        {
            return Results.NotFound();
        }

        user.Name = request.Name.Trim();
        await db.SaveChangesAsync(token);
        return Results.NoContent();
    }
}
