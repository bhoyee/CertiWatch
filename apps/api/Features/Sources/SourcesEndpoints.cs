using System.Collections.ObjectModel;
using System.Text.Json;
using CertiWatch.Api.Domain.Entities;
using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Infrastructure.Security;
using CertiWatch.Api.Infrastructure.Services;
using CertiWatch.Contracts.Dtos;
using CertiWatch.Contracts.Enums;
using CertiWatch.Contracts.Requests;
using Microsoft.EntityFrameworkCore;

namespace CertiWatch.Api.Features.Sources;

public static class SourcesEndpoints
{
    public static IEndpointRouteBuilder MapSourceEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/sources").RequireAuthorization();
        group.MapGet(string.Empty, ListAsync);
        group.MapPost(string.Empty, CreateAsync);
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
        return Results.Ok(sources.Select(ToDtoMasked));
    }

    private static async Task<IResult> CreateAsync(SourceRequest request, AppDbContext db, ITenantContextAccessor tenantAccessor, IDateTimeProvider clock, CancellationToken token)
    {
        if (!RecordVisibility.IsAdmin(tenantAccessor))
        {
            return Results.Forbid();
        }

        var validateResult = Validate(request);
        if (!validateResult.IsValid)
        {
            return Results.BadRequest(new { error = validateResult.Error });
        }

        var tenantId = tenantAccessor.Current.TenantId;
        var entity = new Source
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Type = request.Type,
            DisplayName = string.IsNullOrWhiteSpace(request.DisplayName) ? $"Source {clock.UtcNow:yyyyMMddHHmmss}" : request.DisplayName,
            ConfigJson = JsonSerializer.Serialize(MaskSecrets(validateResult.StoredConfig)),
            CreatedAt = clock.UtcNow
        };

        db.Sources.Add(entity);
        if (validateResult.Secrets.Count > 0)
        {
            foreach (var kvp in validateResult.Secrets)
            {
                db.SourceSecrets.Add(new SourceSecret
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    SourceId = entity.Id,
                    Key = kvp.Key,
                    Value = kvp.Value,
                    CreatedAt = clock.UtcNow
                });
            }
        }

        await db.SaveChangesAsync(token);
        return Results.Created($"/api/sources/{entity.Id}", ToDtoMasked(entity));
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

    private static SourceDto ToDtoMasked(Source source)
    {
        var rawConfig = JsonSerializer.Deserialize<Dictionary<string, string>>(source.ConfigJson) ?? new Dictionary<string, string>();
        rawConfig.TryGetValue("last_sync", out var lastSync);
        rawConfig.TryGetValue("sync_status", out var syncStatus);
        rawConfig.TryGetValue("sync_error", out var syncError);
        return new SourceDto(
            source.Id,
            source.Type,
            source.DisplayName,
            MaskSensitive(rawConfig),
            source.CreatedAt,
            lastSync,
            syncStatus,
            syncError);
    }

    private static (bool IsValid, string? Error, IDictionary<string, string> StoredConfig, IDictionary<string, string> Secrets) Validate(SourceRequest request)
    {
        var cfg = request.Config ?? new Dictionary<string, string>();
        var secrets = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        if (request.Type == SourceType.CloudImport)
        {
            if (!cfg.TryGetValue("provider", out var providerRaw) || string.IsNullOrWhiteSpace(providerRaw))
            {
                return (false, "provider is required for CloudImport", cfg, secrets);
            }

            var provider = providerRaw.Trim().ToLowerInvariant();
            switch (provider)
            {
                case "s3":
                case "minio":
                    if (!cfg.ContainsKey("bucket")) return (false, "bucket is required for S3/MinIO", cfg, secrets);
                    if (!cfg.ContainsKey("accessKey") || !cfg.ContainsKey("secretKey")) return (false, "accessKey and secretKey are required for S3/MinIO", cfg, secrets);
                    break;
                case "gcs":
                    if (!cfg.ContainsKey("bucket")) return (false, "bucket is required for GCS", cfg, secrets);
                    if (!cfg.ContainsKey("serviceAccount")) return (false, "serviceAccount is required for GCS", cfg, secrets);
                    break;
                case "azure":
                    if (!cfg.ContainsKey("container")) return (false, "container is required for Azure Blob", cfg, secrets);
                    if (!cfg.ContainsKey("connectionString") && !(cfg.ContainsKey("accountName") && cfg.ContainsKey("accountKey")))
                    {
                        return (false, "connectionString or accountName/accountKey is required for Azure Blob", cfg, secrets);
                    }
                    break;
                case "dropbox":
                    if (!cfg.ContainsKey("accessToken")) return (false, "accessToken is required for Dropbox", cfg, secrets);
                    break;
                case "gdrive":
                case "google-drive":
                    return (false, "Google Drive import is not supported in this build", cfg, secrets);
                case "onedrive":
                case "sharepoint":
                    return (false, "OneDrive/SharePoint import is not supported in this build", cfg, secrets);
                case "webdav":
                case "httpdir":
                case "http":
                    if (!cfg.ContainsKey("baseUrl")) return (false, "baseUrl is required for WebDAV/HTTP directory", cfg, secrets);
                    break;
                default:
                    return (false, $"Unsupported provider '{providerRaw}'", cfg, secrets);
            }
        }

        foreach (var key in cfg.Keys.ToList())
        {
            if (IsSecretKey(key))
            {
                secrets[key] = cfg[key];
                cfg[key] = string.Empty;
            }
        }

        return (true, null, cfg, secrets);
    }

    private static IReadOnlyDictionary<string, string> MaskSensitive(IDictionary<string, string> config)
    {
        var masked = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var kvp in config)
        {
            if (IsSecretKey(kvp.Key))
            {
                masked[kvp.Key] = string.IsNullOrEmpty(kvp.Value) ? kvp.Value : "********";
            }
            else
            {
                masked[kvp.Key] = kvp.Value;
            }
        }

        return new ReadOnlyDictionary<string, string>(masked);
    }

    private static IDictionary<string, string> MaskSecrets(IDictionary<string, string> config)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var kvp in config)
        {
            result[kvp.Key] = IsSecretKey(kvp.Key) ? string.Empty : kvp.Value;
        }

        return result;
    }

    private static bool IsSecretKey(string key)
    {
        var lowered = key.ToLowerInvariant();
        return lowered.Contains("secret")
               || lowered.Contains("token")
               || lowered.Contains("password")
               || lowered.Contains("connectionstring")
               || lowered.Contains("accesskey")
               || lowered.Contains("accountkey")
               || lowered.Contains("serviceaccount");
    }
}
