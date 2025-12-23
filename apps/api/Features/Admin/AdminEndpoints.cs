using CertiWatch.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using CertiWatch.Api.Infrastructure.Security;
using CertiWatch.Api.Infrastructure.Emails;
using CertiWatch.Api.Configuration;
using CertiWatch.Api.Infrastructure.Services;
using Microsoft.Extensions.Options;
using CertiWatch.Api.Domain.Entities;
using CertiWatch.Api.Features.Auth;

namespace CertiWatch.Api.Features.Admin;

public static class AdminEndpoints
{
    public static IEndpointRouteBuilder MapAdminEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/admin");
        group.RequireAuthorization();
        group.MapGet("/healthz", HealthAsync);
        group.MapGet("/ingestion-logs", LogsAsync);
        group.MapGet("/team/managers", ManagersAsync);
        group.MapGet("/team/managers/{id:guid}/viewers", ManagerViewersAsync);
        group.MapPost("/team/managers", CreateManagerAsync);
        group.MapPost("/team/managers/{id:guid}/viewers", CreateViewerAsync);
        group.MapPatch("/team/users/{id:guid}", UpdateUserAsync);
        group.MapPatch("/team/viewers/{id:guid}/reassign", ReassignViewerAsync);
        group.MapDelete("/team/users/{id:guid}", DeleteUserAsync);
        return group;
    }

    private static bool IsAdmin(ITenantContextAccessor accessor) =>
        string.Equals(accessor.Current.Role, "admin", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(accessor.Current.Role, "superadmin", StringComparison.OrdinalIgnoreCase);

    private static IResult ForbidIfNotAdmin(ITenantContextAccessor accessor)
        => IsAdmin(accessor) ? null! : Results.Forbid();

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

    private static async Task<IResult> ManagersAsync(AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        if (!IsAdmin(accessor)) return Results.Forbid();
        var tenantId = accessor.Current.TenantId;
        var managers = await db.Users.AsNoTracking()
            .Where(u => u.TenantId == tenantId && u.Role.ToLower() == "manager")
            .OrderBy(u => u.CreatedAt)
            .ToListAsync(token);

        var managerIds = managers.Select(m => m.Id).ToList();
        var viewerCounts = await db.Users.AsNoTracking()
            .Where(u => u.TenantId == tenantId && u.Role.ToLower() == "viewer" && u.InvitedByUserId.HasValue && managerIds.Contains(u.InvitedByUserId.Value))
            .GroupBy(u => u.InvitedByUserId!.Value)
            .ToDictionaryAsync(g => g.Key, g => g.Count(), token);

        var result = managers.Select(m => new
        {
            m.Id,
            m.Email,
            m.Name,
            m.CreatedAt,
            ViewerCount = viewerCounts.TryGetValue(m.Id, out var count) ? count : 0
        });

        return Results.Ok(result);
    }

    private static async Task<IResult> ManagerViewersAsync(Guid id, AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        if (!IsAdmin(accessor)) return Results.Forbid();
        var tenantId = accessor.Current.TenantId;
        var viewers = await db.Users.AsNoTracking()
            .Where(u => u.TenantId == tenantId && u.Role.ToLower() == "viewer" && u.InvitedByUserId == id)
            .OrderBy(u => u.CreatedAt)
            .ToListAsync(token);

        return Results.Ok(viewers.Select(v => new { v.Id, v.Email, v.Name, v.CreatedAt }));
    }

    private sealed record UpsertUserRequest(string Email, string? Name);
    private sealed record UpdateUserRequest(string? Name, string? Role);
    private sealed record ReassignRequest(Guid ManagerId);

    private static async Task<IResult> CreateManagerAsync(
        UpsertUserRequest request,
        AppDbContext db,
        ITenantContextAccessor accessor,
        IOptions<MagicLinkOptions> magicOptions,
        IEmailTemplateRenderer renderer,
        IEmailService emailService,
        CancellationToken token)
    {
        if (!IsAdmin(accessor)) return Results.Forbid();
        if (string.IsNullOrWhiteSpace(request.Email)) return Results.BadRequest(new { error = "email_required" });

        var tenantId = accessor.Current.TenantId;
        var invitedBy = accessor.Current.UserId;
        var email = request.Email.Trim();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email && u.TenantId == tenantId, token);
        if (user is null)
        {
            user = new User
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Email = email,
                Name = string.IsNullOrWhiteSpace(request.Name) ? email : request.Name.Trim(),
                Role = "manager",
                InvitedByUserId = invitedBy
            };
            db.Users.Add(user);
        }
        else
        {
            user.Role = "manager";
            user.InvitedByUserId ??= invitedBy;
            if (!string.IsNullOrWhiteSpace(request.Name))
            {
                user.Name = request.Name.Trim();
            }
        }

        await db.SaveChangesAsync(token);
        await SendMagicLinkAsync(email, tenantId, magicOptions.Value, renderer, emailService, token);
        return Results.Ok(new { user.Id, user.Email, user.Name, user.Role, user.InvitedByUserId });
    }

    private static async Task<IResult> CreateViewerAsync(
        Guid id,
        UpsertUserRequest request,
        AppDbContext db,
        ITenantContextAccessor accessor,
        IOptions<MagicLinkOptions> magicOptions,
        IEmailTemplateRenderer renderer,
        IEmailService emailService,
        CancellationToken token)
    {
        if (!IsAdmin(accessor)) return Results.Forbid();
        if (string.IsNullOrWhiteSpace(request.Email)) return Results.BadRequest(new { error = "email_required" });

        var tenantId = accessor.Current.TenantId;
        var manager = await db.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == id && u.TenantId == tenantId && u.Role.ToLower() == "manager", token);
        if (manager is null) return Results.NotFound(new { error = "manager_not_found" });

        var email = request.Email.Trim();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email && u.TenantId == tenantId, token);
        if (user is null)
        {
            user = new User
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Email = email,
                Name = string.IsNullOrWhiteSpace(request.Name) ? email : request.Name.Trim(),
                Role = "viewer",
                InvitedByUserId = manager.Id
            };
            db.Users.Add(user);
        }
        else
        {
            user.Role = "viewer";
            user.InvitedByUserId = manager.Id;
            if (!string.IsNullOrWhiteSpace(request.Name))
            {
                user.Name = request.Name.Trim();
            }
        }

        await db.SaveChangesAsync(token);
        await SendMagicLinkAsync(email, tenantId, magicOptions.Value, renderer, emailService, token);
        return Results.Ok(new { user.Id, user.Email, user.Name, user.Role, user.InvitedByUserId });
    }

    private static async Task<IResult> UpdateUserAsync(
        Guid id,
        UpdateUserRequest request,
        AppDbContext db,
        ITenantContextAccessor accessor,
        CancellationToken token)
    {
        if (!IsAdmin(accessor)) return Results.Forbid();
        var tenantId = accessor.Current.TenantId;
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id && u.TenantId == tenantId, token);
        if (user is null) return Results.NotFound();

        if (!string.IsNullOrWhiteSpace(request.Name))
        {
            user.Name = request.Name.Trim();
        }

        if (!string.IsNullOrWhiteSpace(request.Role))
        {
            var role = request.Role.Trim().ToLower();
            if (role is not ("admin" or "manager" or "viewer"))
            {
                return Results.BadRequest(new { error = "invalid_role" });
            }
            user.Role = role;
        }

        await db.SaveChangesAsync(token);
        return Results.NoContent();
    }

    private static async Task<IResult> ReassignViewerAsync(
        Guid id,
        ReassignRequest request,
        AppDbContext db,
        ITenantContextAccessor accessor,
        CancellationToken token)
    {
        if (!IsAdmin(accessor)) return Results.Forbid();
        var tenantId = accessor.Current.TenantId;
        var viewer = await db.Users.FirstOrDefaultAsync(u => u.Id == id && u.TenantId == tenantId, token);
        if (viewer is null) return Results.NotFound();
        if (!string.Equals(viewer.Role, "viewer", StringComparison.OrdinalIgnoreCase))
        {
            return Results.BadRequest(new { error = "not_a_viewer" });
        }

        var manager = await db.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == request.ManagerId && u.TenantId == tenantId && u.Role.ToLower() == "manager", token);
        if (manager is null) return Results.BadRequest(new { error = "manager_not_found" });

        viewer.InvitedByUserId = manager.Id;
        await db.SaveChangesAsync(token);
        return Results.NoContent();
    }

    private static async Task<IResult> DeleteUserAsync(
        Guid id,
        AppDbContext db,
        ITenantContextAccessor accessor,
        CancellationToken token)
    {
        if (!IsAdmin(accessor)) return Results.Forbid();
        var tenantId = accessor.Current.TenantId;
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id && u.TenantId == tenantId, token);
        if (user is null) return Results.NotFound();

        if (string.Equals(user.Role, "manager", StringComparison.OrdinalIgnoreCase))
        {
            var hasViewers = await db.Users.AnyAsync(u => u.InvitedByUserId == id && u.TenantId == tenantId, token);
            if (hasViewers) return Results.BadRequest(new { error = "manager_has_viewers" });
        }

        db.Users.Remove(user);
        await db.SaveChangesAsync(token);
        return Results.NoContent();
    }

    private static async Task SendMagicLinkAsync(
        string email,
        Guid tenantId,
        MagicLinkOptions options,
        IEmailTemplateRenderer renderer,
        IEmailService emailService,
        CancellationToken token)
    {
        var tokenString = MagicLinkTokenService.CreateToken(
            email,
            tenantId,
            options.Secret,
            TimeSpan.FromMinutes(options.ExpiryMinutes),
            purpose: "magic",
            rememberDevice: true,
            deviceId: null);
        var link = $"{options.BaseUrl.TrimEnd('/')}/magic?token={tokenString}";
        var html = renderer.RenderMagicLink(email, link);
        await emailService.SendAsync(email, "Your CertiWatch login link", html, token);
    }
}
