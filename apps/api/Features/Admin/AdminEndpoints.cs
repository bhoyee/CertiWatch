using CertiWatch.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using CertiWatch.Api.Infrastructure.Security;

namespace CertiWatch.Api.Features.Admin;

// The /team/* routes that used to live here (managers/viewers CRUD + reassignment) were a second,
// parallel invite system duplicating /api/auth/invite + /api/users - same outcome (create a user,
// email them a magic link), different UI. Removed in favor of consolidating everything into the
// Invite page; UserManagementEndpoints (isDisabled + managerId on PATCH /api/users/{id}) picked up
// the two capabilities (disable/enable, reassign a viewer's manager) that page didn't already have.
public static class AdminEndpoints
{
    public static IEndpointRouteBuilder MapAdminEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/admin");
        group.RequireAuthorization();
        group.MapGet("/healthz", HealthAsync);
        group.MapGet("/ingestion-logs", LogsAsync);
        return group;
    }

    private static bool IsAdmin(ITenantContextAccessor accessor) =>
        string.Equals(accessor.Current.Role, "admin", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(accessor.Current.Role, "superadmin", StringComparison.OrdinalIgnoreCase);

    private static async Task<IResult> HealthAsync(AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        if (!IsAdmin(accessor)) return Results.Forbid();
        var canConnect = await db.Database.CanConnectAsync(token);
        return canConnect ? Results.Ok(new { status = "ok", timestamp = DateTime.UtcNow }) : Results.Problem("database unavailable");
    }

    private static async Task<IResult> LogsAsync(AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        if (!IsAdmin(accessor)) return Results.Forbid();
        var logs = await db.AuditLogs.AsNoTracking().OrderByDescending(l => l.CreatedAt).Take(50).ToListAsync(token);
        return Results.Ok(logs.Select(l => new { l.Id, l.Action, l.MetaJson, l.CreatedAt }));
    }

}
