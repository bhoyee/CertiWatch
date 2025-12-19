using CertiWatch.Api.Domain.Entities;
using CertiWatch.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CertiWatch.Api.Infrastructure.Security;

internal static class RecordVisibility
{
    internal sealed record ViewerScope(string? StaffName, string? Email);

    internal static bool IsViewer(ITenantContextAccessor accessor)
        => string.Equals(accessor.Current.Role, "viewer", StringComparison.OrdinalIgnoreCase);

    internal static bool IsAdmin(ITenantContextAccessor accessor)
        => string.Equals(accessor.Current.Role, "admin", StringComparison.OrdinalIgnoreCase)
           || string.Equals(accessor.Current.Role, "superadmin", StringComparison.OrdinalIgnoreCase);

    internal static async Task<ViewerScope?> GetViewerScopeAsync(
        AppDbContext db,
        ITenantContextAccessor accessor,
        CancellationToken token)
    {
        if (!IsViewer(accessor))
        {
            return null;
        }

        var tenantId = accessor.Current.TenantId;
        var email = accessor.Current.Email?.Trim();
        var name = await db.Users.AsNoTracking()
            .Where(u => u.TenantId == tenantId && u.Email == email)
            .Select(u => u.Name)
            .FirstOrDefaultAsync(token);

        if (string.IsNullOrWhiteSpace(name) && !string.IsNullOrWhiteSpace(email))
        {
            name = DeriveNameFromEmail(email);
        }

        return new ViewerScope(name, email);
    }

    internal static IQueryable<Record> ApplyViewerScope(IQueryable<Record> query, ViewerScope? scope)
    {
        if (scope is null)
        {
            return query;
        }

        var name = scope.StaffName?.Trim();
        var email = scope.Email?.Trim();
        var hasName = !string.IsNullOrWhiteSpace(name);
        if (!hasName)
        {
            return query.Where(_ => false);
        }

        // Token-based match: require every token from the viewer's name to appear in staff name (order agnostic).
        var tokens = name.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        foreach (var token in tokens)
        {
            var tokenPattern = $"%{token}%";
            query = query.Where(r => EF.Functions.ILike(r.StaffName ?? string.Empty, tokenPattern));
        }

        // Limit to staff name only to avoid casting jsonb, which can fail on legacy malformed data.
        return query;
    }

    private static string? DeriveNameFromEmail(string email)
    {
        var parts = email.Split('@', 2);
        if (parts.Length == 0) return null;
        var local = parts[0].Replace(".", " ").Replace("_", " ").Replace("-", " ").Trim();
        return string.IsNullOrWhiteSpace(local) ? null : local;
    }
}
