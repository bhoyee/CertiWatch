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

    private sealed record UserListItem(Guid Id, string Email, string? Name, string Role, Guid? InvitedByUserId, DateTime CreatedAt, bool IsDisabled, DateTime? LastLoginAt);
    private sealed record UpdateUserRequest(string? Name, string? Role, bool? IsDisabled, Guid? ManagerId);

    private static bool IsAdmin(ITenantContextAccessor accessor) =>
        string.Equals(accessor.Current.Role, "admin", StringComparison.OrdinalIgnoreCase);

    private static bool IsManager(ITenantContextAccessor accessor) =>
        string.Equals(accessor.Current.Role, "manager", StringComparison.OrdinalIgnoreCase);

    private static bool IsAdminOrManager(ITenantContextAccessor accessor) => IsAdmin(accessor) || IsManager(accessor);

    private static async Task<IResult> ListAsync(AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        var isAdmin = IsAdmin(accessor);
        var isManager = IsManager(accessor);
        if (!isAdmin && !isManager)
        {
            return Results.Forbid();
        }

        var tenantId = accessor.Current.TenantId;
        var query = db.Users.AsNoTracking().Where(u => u.TenantId == tenantId);
        if (isManager)
        {
            var managerId = accessor.Current.UserId;
            if (managerId == Guid.Empty)
            {
                return Results.Ok(Array.Empty<UserListItem>());
            }
            query = query.Where(u => u.Role.ToLower() == "viewer" && u.InvitedByUserId == managerId);
        }

        var users = await query
            .Where(u => u.TenantId == tenantId)
            .OrderBy(u => u.Email)
            .Select(u => new { u.Id, u.Email, u.Name, u.Role, u.InvitedByUserId, u.CreatedAt, u.IsDisabled })
            .ToListAsync(token);

        // Precomputed to a plain List<Guid> so the GroupBy below is a well-supported EF "IN"
        // translation - the same pattern used for the platform tenant users' last-login column.
        var userIds = users.Select(u => u.Id).ToList();
        var lastLogins = await db.AuditLogs.AsNoTracking()
            .Where(a => a.Action == "auth_login" && a.ActorId.HasValue && userIds.Contains(a.ActorId.Value))
            .GroupBy(a => a.ActorId!.Value)
            .Select(g => new { UserId = g.Key, LastLoginAt = g.Max(a => a.CreatedAt) })
            .ToDictionaryAsync(x => x.UserId, x => x.LastLoginAt, token);

        var result = users.Select(u => new UserListItem(
            u.Id,
            u.Email,
            u.Name,
            u.Role,
            u.InvitedByUserId,
            u.CreatedAt,
            u.IsDisabled,
            lastLogins.TryGetValue(u.Id, out var lastLogin) ? lastLogin : null));

        return Results.Ok(result);
    }

    private static async Task<IResult> UpdateAsync(Guid id, UpdateUserRequest request, AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        var isAdmin = IsAdmin(accessor);
        var isManager = IsManager(accessor);
        if (!isAdmin && !isManager)
        {
            return Results.Forbid();
        }

        var tenantId = accessor.Current.TenantId;
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id && u.TenantId == tenantId, token);
        if (user is null)
        {
            return Results.NotFound();
        }

        if (isManager && !string.Equals(user.Role, "viewer", StringComparison.OrdinalIgnoreCase))
        {
            return Results.Forbid();
        }
        if (isManager && user.InvitedByUserId != accessor.Current.UserId)
        {
            return Results.Forbid();
        }

        if (!string.IsNullOrWhiteSpace(request.Name))
        {
            user.Name = request.Name.Trim();
        }

        if (!string.IsNullOrWhiteSpace(request.Role))
        {
            if (isManager && !string.Equals(request.Role, "viewer", StringComparison.OrdinalIgnoreCase))
            {
                return Results.BadRequest(new { error = "managers_can_only_manage_viewers" });
            }
            user.Role = request.Role.Trim();
        }

        if (request.IsDisabled.HasValue)
        {
            if (!string.IsNullOrWhiteSpace(accessor.Current.Email) &&
                string.Equals(user.Email, accessor.Current.Email, StringComparison.OrdinalIgnoreCase))
            {
                return Results.BadRequest(new { error = "cannot_disable_self" });
            }
            user.IsDisabled = request.IsDisabled.Value;
        }

        if (request.ManagerId.HasValue)
        {
            // Reassigning who a viewer reports to is an admin-only action - a manager handing
            // their own viewer off to someone else isn't a case the UI exposes.
            if (isManager)
            {
                return Results.Forbid();
            }
            if (!string.Equals(user.Role, "viewer", StringComparison.OrdinalIgnoreCase))
            {
                return Results.BadRequest(new { error = "only_viewers_have_a_manager" });
            }
            var newManager = await db.Users.AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == request.ManagerId.Value && u.TenantId == tenantId && u.Role.ToLower() == "manager", token);
            if (newManager is null)
            {
                return Results.BadRequest(new { error = "manager_not_found" });
            }
            user.InvitedByUserId = newManager.Id;
        }

        await db.SaveChangesAsync(token);
        return Results.NoContent();
    }

    private static async Task<IResult> DeleteAsync(Guid id, AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        var isAdmin = IsAdmin(accessor);
        var isManager = IsManager(accessor);
        if (!isAdmin && !isManager)
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

        if (isManager && !string.Equals(user.Role, "viewer", StringComparison.OrdinalIgnoreCase))
        {
            return Results.Forbid();
        }
        if (isManager && user.InvitedByUserId != accessor.Current.UserId)
        {
            return Results.Forbid();
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
