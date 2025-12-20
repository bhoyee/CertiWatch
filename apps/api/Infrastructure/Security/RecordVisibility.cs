using CertiWatch.Api.Domain.Entities;
using CertiWatch.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CertiWatch.Api.Infrastructure.Security;

internal static class RecordVisibility
{
    internal sealed record Scope(
        bool IsViewer,
        bool IsManager,
        Guid? UserId,
        IReadOnlyList<Guid> AllowedCreatorIds,
        IReadOnlyList<string> StaffTokens);

    internal static bool IsViewer(ITenantContextAccessor accessor)
        => string.Equals(accessor.Current.Role, "viewer", StringComparison.OrdinalIgnoreCase);

    internal static bool IsManager(ITenantContextAccessor accessor)
        => string.Equals(accessor.Current.Role, "manager", StringComparison.OrdinalIgnoreCase);

    internal static bool IsAdmin(ITenantContextAccessor accessor)
        => string.Equals(accessor.Current.Role, "admin", StringComparison.OrdinalIgnoreCase)
           || string.Equals(accessor.Current.Role, "superadmin", StringComparison.OrdinalIgnoreCase);

    internal static async Task<Scope?> GetScopeAsync(
        AppDbContext db,
        ITenantContextAccessor accessor,
        CancellationToken token)
    {
        var role = accessor.Current.Role?.ToLowerInvariant();
        var isViewer = role == "viewer";
        var isManager = role == "manager";

        if (!isViewer && !isManager)
        {
            return null;
        }

        var tenantId = accessor.Current.TenantId;
        var email = accessor.Current.Email?.Trim();
        var userId = accessor.Current.UserId;

        // Collect allowed creator ids
        var creatorIds = new List<Guid>();
        if (userId != Guid.Empty)
        {
            creatorIds.Add(userId);
        }

        if (isManager && userId != Guid.Empty)
        {
            // Managers can see uploads created by themselves or viewers they invited.
            var invitedIds = await db.Users.AsNoTracking()
                .Where(u => u.TenantId == tenantId && u.InvitedByUserId == userId && u.Role.ToLower() == "viewer")
                .Select(u => u.Id)
                .ToListAsync(token);
            creatorIds.AddRange(invitedIds);
        }

        // Staff tokens used as a fallback for legacy rows without CreatedByUserId.
        var name = await db.Users.AsNoTracking()
            .Where(u => u.TenantId == tenantId && u.Email == email)
            .Select(u => u.Name)
            .FirstOrDefaultAsync(token);

        if (string.IsNullOrWhiteSpace(name) && !string.IsNullOrWhiteSpace(email))
        {
            name = DeriveNameFromEmail(email);
        }

        var tokens = string.IsNullOrWhiteSpace(name)
            ? Array.Empty<string>()
            : name.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        return new Scope(isViewer, isManager, userId == Guid.Empty ? null : userId, creatorIds, tokens);
    }

    internal static IQueryable<Record> ApplyScope(IQueryable<Record> query, Scope? scope)
    {
        if (scope is null)
        {
            return query;
        }

        var allowedCreators = scope.AllowedCreatorIds?.Where(id => id != Guid.Empty).Distinct().ToList() ?? [];
        var tokens = scope.StaffTokens ?? Array.Empty<string>();
        var hasTokens = tokens.Count > 0;
        var hasCreators = allowedCreators.Count > 0;

        // If we have neither creators nor tokens, restrict to none.
        if (!hasCreators && !hasTokens)
        {
            return query.Where(_ => false);
        }

        return query.Where(r =>
            (hasCreators && r.CreatedByUserId.HasValue && allowedCreators.Contains(r.CreatedByUserId.Value))
            ||
            (hasTokens && tokens.All(tok => EF.Functions.ILike(r.StaffName ?? string.Empty, "%" + tok + "%"))));
    }

    private static string? DeriveNameFromEmail(string email)
    {
        var parts = email.Split('@', 2);
        if (parts.Length == 0) return null;
        var local = parts[0].Replace(".", " ").Replace("_", " ").Replace("-", " ").Trim();
        return string.IsNullOrWhiteSpace(local) ? null : local;
    }
}
