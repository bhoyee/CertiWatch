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
        var hasEmail = !string.IsNullOrWhiteSpace(email);

        if (!hasName && !hasEmail)
        {
            return query.Where(_ => false);
        }

        if (hasName && hasEmail)
        {
            var namePattern = $"%{name}%";
            var emailPattern = $"%{email}%";
            return query.Where(r =>
                EF.Functions.ILike(r.StaffName ?? string.Empty, namePattern) ||
                EF.Functions.ILike(r.FieldsJson ?? string.Empty, emailPattern));
        }

        if (hasName)
        {
            var namePattern = $"%{name}%";
            return query.Where(r => EF.Functions.ILike(r.StaffName ?? string.Empty, namePattern));
        }

        var emailOnlyPattern = $"%{email}%";
        return query.Where(r => EF.Functions.ILike(r.FieldsJson ?? string.Empty, emailOnlyPattern));
    }

    private static string? DeriveNameFromEmail(string email)
    {
        var parts = email.Split('@', 2);
        if (parts.Length == 0) return null;
        var local = parts[0].Replace(".", " ").Replace("_", " ").Replace("-", " ").Trim();
        return string.IsNullOrWhiteSpace(local) ? null : local;
    }
}
