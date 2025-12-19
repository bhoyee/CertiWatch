using CertiWatch.Api.Domain.Entities;
using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;

namespace CertiWatch.Api.Features.Admin;

public static class UserManagementEndpoints
{
    public static IEndpointRouteBuilder MapUserManagementEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/users").RequireAuthorization();
        group.MapGet(string.Empty, ListAsync);
        group.MapPatch("{id:guid}", UpdateAsync);
        group.MapDelete("{id:guid}", DeleteAsync);
        return routes;
    }

    private sealed record UserListItem(Guid Id, string Email, string? Name, string Role, DateTime CreatedAt);
    private sealed record UpdateUserRequest(string? Name, string? Role);

    private static bool IsAdmin(ITenantContextAccessor accessor) =>
        string.Equals(accessor.Current.Role, "admin", StringComparison.OrdinalIgnoreCase);

    private static async Task<IResult> ListAsync(AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        if (!IsAdmin(accessor))
        {
            return Results.Forbid();
        }

        var tenantId = accessor.Current.TenantId;
        var users = await db.Users.AsNoTracking()
            .Where(u => u.TenantId == tenantId)
            .OrderBy(u => u.Email)
            .Select(u => new UserListItem(u.Id, u.Email, u.Name, u.Role, u.CreatedAt))
            .ToListAsync(token);

        return Results.Ok(users);
    }

    private static async Task<IResult> UpdateAsync(Guid id, UpdateUserRequest request, AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        if (!IsAdmin(accessor))
        {
            return Results.Forbid();
        }

        var tenantId = accessor.Current.TenantId;
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id && u.TenantId == tenantId, token);
        if (user is null)
        {
            return Results.NotFound();
        }

        if (!string.IsNullOrWhiteSpace(request.Name))
        {
            user.Name = request.Name.Trim();
        }

        if (!string.IsNullOrWhiteSpace(request.Role))
        {
            user.Role = request.Role.Trim();
        }

        await db.SaveChangesAsync(token);
        return Results.NoContent();
    }

    private static async Task<IResult> DeleteAsync(Guid id, AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        if (!IsAdmin(accessor))
        {
            return Results.Forbid();
        }

        var tenantId = accessor.Current.TenantId;
        var currentEmail = accessor.Current.Email;

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id && u.TenantId == tenantId, token);
        if (user is null)
        {
            return Results.NotFound();
        }

        if (!string.IsNullOrWhiteSpace(currentEmail) && string.Equals(user.Email, currentEmail, StringComparison.OrdinalIgnoreCase))
        {
            return Results.BadRequest(new { error = "cannot_delete_self" });
        }

        db.Users.Remove(user);
        await db.SaveChangesAsync(token);
        return Results.NoContent();
    }
}
