using System.Text.Json;
using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Infrastructure.Security;
using CertiWatch.Api.Infrastructure.Services;
using CertiWatch.Contracts.Dtos;
using CertiWatch.Contracts.Requests;
using Microsoft.EntityFrameworkCore;

namespace CertiWatch.Api.Features.Sources;

// A Source here only ever comes from finishing the Google Drive/OneDrive OAuth flow (see
// SourceOAuthEndpoints) - there's no manual "create" endpoint, since that flow is what puts a
// tenant-scoped refresh token in SourceSecrets in the first place. What's left here is reading the
// list, deleting a connection, choosing which folder to watch, and asking for an out-of-band sync.
public static class SourcesEndpoints
{
    public static IEndpointRouteBuilder MapSourceEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/sources").RequireAuthorization();
        group.MapGet(string.Empty, ListAsync);
        group.MapPatch("/{id:guid}", UpdateConfigAsync);
        group.MapDelete("/{id:guid}", DeleteAsync);
        group.MapPost("/{id:guid}/sync-now", RequestSyncAsync);
        return group;
    }

    private static async Task<IResult> ListAsync(AppDbContext db, ITenantContextAccessor tenantAccessor, CancellationToken token)
    {
        if (!RecordVisibility.IsAdmin(tenantAccessor))
        {
            return Results.Forbid();
        }

        var tenantId = tenantAccessor.Current.TenantId;
        var sources = await db.Sources.AsNoTracking().Where(s => s.TenantId == tenantId).ToListAsync(token);
        return Results.Ok(sources.Select(ToDto));
    }

    // The OAuth callback creates the Source before the tenant has picked a folder (Google/
    // Microsoft's consent screen doesn't have a "pick a folder" step in this flow) - this is what
    // fills that in afterward, and also lets the tenant rename the connection or change folders
    // later without disconnecting and reconnecting.
    private static async Task<IResult> UpdateConfigAsync(
        Guid id,
        UpdateSourceConfigRequest request,
        AppDbContext db,
        ITenantContextAccessor tenantAccessor,
        CancellationToken token)
    {
        if (!RecordVisibility.IsAdmin(tenantAccessor))
        {
            return Results.Forbid();
        }

        var entity = await db.Sources.FirstOrDefaultAsync(s => s.Id == id && s.TenantId == tenantAccessor.Current.TenantId, token);
        if (entity is null)
        {
            return Results.NotFound();
        }

        if (!string.IsNullOrWhiteSpace(request.DisplayName))
        {
            entity.DisplayName = request.DisplayName;
        }

        if (request.SharedWithAllManagers.HasValue)
        {
            entity.SharedWithAllManagers = request.SharedWithAllManagers.Value;
        }

        if (request.FolderId is not null)
        {
            var cfg = JsonSerializer.Deserialize<Dictionary<string, string>>(entity.ConfigJson) ?? new Dictionary<string, string>();
            cfg["folderId"] = request.FolderId;
            // Always resolve the label alongside the ID rather than only ever setting one: fixing
            // a mistyped folder ID without this would leave the previous (now-wrong) label
            // displayed in place of the corrected raw ID.
            if (!string.IsNullOrWhiteSpace(request.FolderLabel))
            {
                cfg["folderLabel"] = request.FolderLabel;
            }
            else
            {
                cfg.Remove("folderLabel");
            }
            entity.ConfigJson = JsonSerializer.Serialize(cfg);
        }

        await db.SaveChangesAsync(token);
        return Results.Ok(ToDto(entity));
    }

    private static async Task<IResult> DeleteAsync(Guid id, AppDbContext db, ITenantContextAccessor tenantAccessor, CancellationToken token)
    {
        if (!RecordVisibility.IsAdmin(tenantAccessor))
        {
            return Results.Forbid();
        }

        var entity = await db.Sources.FirstOrDefaultAsync(s => s.Id == id && s.TenantId == tenantAccessor.Current.TenantId, token);
        if (entity is null)
        {
            return Results.NotFound();
        }

        var secrets = db.SourceSecrets.Where(s => s.SourceId == id && s.TenantId == tenantAccessor.Current.TenantId);
        db.SourceSecrets.RemoveRange(secrets);
        db.Sources.Remove(entity);
        await db.SaveChangesAsync(token);
        return Results.NoContent();
    }

    private static async Task<IResult> RequestSyncAsync(Guid id, AppDbContext db, ITenantContextAccessor tenantAccessor, IDateTimeProvider clock, CancellationToken token)
    {
        if (!RecordVisibility.IsAdmin(tenantAccessor))
        {
            return Results.Forbid();
        }

        var entity = await db.Sources.FirstOrDefaultAsync(s => s.Id == id && s.TenantId == tenantAccessor.Current.TenantId, token);
        if (entity is null)
        {
            return Results.NotFound();
        }

        var cfg = JsonSerializer.Deserialize<Dictionary<string, string>>(entity.ConfigJson) ?? new Dictionary<string, string>();
        cfg["sync_status"] = "queued";
        cfg["sync_error"] = string.Empty;
        cfg["last_sync"] = clock.UtcNow.ToString("O");
        entity.ConfigJson = JsonSerializer.Serialize(cfg);
        await db.SaveChangesAsync(token);
        return Results.Accepted();
    }

    private static SourceDto ToDto(CertiWatch.Api.Domain.Entities.Source source)
    {
        var config = JsonSerializer.Deserialize<Dictionary<string, string>>(source.ConfigJson) ?? new Dictionary<string, string>();
        config.TryGetValue("last_sync", out var lastSync);
        config.TryGetValue("sync_status", out var syncStatus);
        config.TryGetValue("sync_error", out var syncError);
        return new SourceDto(
            source.Id,
            source.Type,
            source.DisplayName,
            config,
            source.CreatedAt,
            lastSync,
            syncStatus,
            syncError,
            source.SharedWithAllManagers);
    }
}
