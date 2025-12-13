using System.Text.Json;
using System.Collections.ObjectModel;
using CertiWatch.Api.Domain.Entities;
using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Infrastructure.Services;
using CertiWatch.Api.Infrastructure.Security;
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
        return group;
    }

    private static async Task<IResult> ListAsync(AppDbContext db, ITenantContextAccessor tenantAccessor, CancellationToken token)
    {
        var tenantId = tenantAccessor.Current.TenantId;
        var sources = await db.Sources.AsNoTracking().Where(s => s.TenantId == tenantId).ToListAsync(token);
        return Results.Ok(sources.Select(s => ToDto(s)));
    }

    private static async Task<IResult> CreateAsync(SourceRequest request, AppDbContext db, ITenantContextAccessor tenantAccessor, IDateTimeProvider clock, CancellationToken token)
    {
        var validateResult = Validate(request);
        if (!validateResult.IsValid)
        {
            return Results.BadRequest(new { error = validateResult.Error });
        }

        var entity = new Source
        {
            Id = Guid.NewGuid(),
            TenantId = tenantAccessor.Current.TenantId,
            Type = request.Type,
            DisplayName = string.IsNullOrWhiteSpace(request.DisplayName) ? $"Source {clock.UtcNow:yyyyMMddHHmmss}" : request.DisplayName,
            ConfigJson = JsonSerializer.Serialize(validateResult.StoredConfig),
            CreatedAt = clock.UtcNow
        };

        db.Sources.Add(entity);
        await db.SaveChangesAsync(token);
        return Results.Created($"/api/sources/{entity.Id}", ToDto(entity));
    }

    private static async Task<IResult> DeleteAsync(Guid id, AppDbContext db, ITenantContextAccessor tenantAccessor, CancellationToken token)
    {
        var entity = await db.Sources.FirstOrDefaultAsync(s => s.Id == id && s.TenantId == tenantAccessor.Current.TenantId, token);
        if (entity is null)
        {
            return Results.NotFound();
        }

        db.Sources.Remove(entity);
        await db.SaveChangesAsync(token);
        return Results.NoContent();
    }

    private static SourceDto ToDto(Source source)
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

    private static (bool IsValid, string? Error, IDictionary<string, string> StoredConfig) Validate(SourceRequest request)
    {
        var cfg = request.Config ?? new Dictionary<string, string>();

        if (request.Type == SourceType.CloudImport)
        {
            if (!cfg.TryGetValue("provider", out var providerRaw) || string.IsNullOrWhiteSpace(providerRaw))
            {
                return (false, "provider is required for CloudImport", cfg);
            }

            var provider = providerRaw.Trim().ToLowerInvariant();
            switch (provider)
            {
                case "s3":
                case "minio":
                    if (!cfg.ContainsKey("bucket")) return (false, "bucket is required for S3/MinIO", cfg);
                    if (!cfg.ContainsKey("accessKey") || !cfg.ContainsKey("secretKey")) return (false, "accessKey and secretKey are required for S3/MinIO", cfg);
                    break;
                case "gcs":
                    if (!cfg.ContainsKey("bucket")) return (false, "bucket is required for GCS", cfg);
                    if (!cfg.ContainsKey("serviceAccount")) return (false, "serviceAccount is required for GCS", cfg);
                    break;
                case "azure":
                    if (!cfg.ContainsKey("container")) return (false, "container is required for Azure Blob", cfg);
                    if (!cfg.ContainsKey("connectionString") && !(cfg.ContainsKey("accountName") && cfg.ContainsKey("accountKey")))
                    {
                        return (false, "connectionString or accountName/accountKey is required for Azure Blob", cfg);
                    }
                    break;
                case "dropbox":
                    if (!cfg.ContainsKey("accessToken")) return (false, "accessToken is required for Dropbox", cfg);
                    break;
                case "gdrive":
                case "google-drive":
                    return (false, "Google Drive import is not supported in this build", cfg);
                case "onedrive":
                case "sharepoint":
                    return (false, "OneDrive/SharePoint import is not supported in this build", cfg);
                case "webdav":
                case "httpdir":
                case "http":
                    if (!cfg.ContainsKey("baseUrl")) return (false, "baseUrl is required for WebDAV/HTTP directory", cfg);
                    break;
                default:
                    return (false, $"Unsupported provider '{providerRaw}'", cfg);
            }
        }

        return (true, null, cfg);
    }

    private static IReadOnlyDictionary<string, string> MaskSensitive(IDictionary<string, string> config)
    {
        var masked = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var kvp in config)
        {
            if (IsSecretKey(kvp.Key))
            {
                masked[kvp.Key] = string.IsNullOrEmpty(kvp.Value) ? kvp.Value : "••••••";
            }
            else
            {
                masked[kvp.Key] = kvp.Value;
            }
        }

        return new ReadOnlyDictionary<string, string>(masked);
    }

    private static bool IsSecretKey(string key)
    {
        var lowered = key.ToLowerInvariant();
        return lowered.Contains("secret")
               || lowered.Contains("token")
               || lowered.Contains("password")
               || lowered.Contains("connectionstring");
    }
}
