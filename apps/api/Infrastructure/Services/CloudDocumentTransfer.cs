using System.Net.Http.Headers;
using System.Text.Json;
using CertiWatch.Api.Configuration;
using CertiWatch.Api.Domain.Entities;
using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Contracts.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace CertiWatch.Api.Infrastructure.Services;

// Moves a single file to or from Google Drive/OneDrive - both directions share the same
// refresh-token exchange, so they live in one service rather than two. Fetch is used by
// DocumentsEndpoints for a "cloudref:{fileId}" Document (one that came FROM a watched Drive
// folder - see DocumentIngestionWorker.SetCloudReference). Upload is used by
// DocumentIngestionWorker for a staff-upload-link/Upload-page file, so it lands in the tenant's
// own connected storage instead of ours - see ResolveUploadDestinationAsync for how the provider
// is chosen when more than one is connected.
public interface ICloudDocumentTransfer
{
    Task<CloudDocumentResult?> FetchAsync(Guid tenantId, Guid sourceId, string cloudFileId, CancellationToken token);

    // Null means "nothing usable is connected" - caller should fall back to archiving locally.
    Task<Guid?> ResolveUploadDestinationAsync(Guid tenantId, CancellationToken token);

    // Null means the upload failed (network error, provider rejected it, token expired) - caller
    // should fall back to archiving locally rather than losing the document.
    Task<string?> UploadAsync(Guid tenantId, Guid sourceId, string fileName, string mimeType, Stream content, CancellationToken token);
}

public sealed record CloudDocumentResult(Stream Content, string? ContentType);

public sealed class CloudDocumentTransfer : ICloudDocumentTransfer
{
    // Same reasoning as SourceOAuthEndpoints.OAuthHttpClient - this API has no IHttpClientFactory
    // registered (minimal API mis-infers an unregistered one as a JSON body parameter), so a
    // shared static client avoids per-call socket exhaustion without needing that registration.
    private static readonly HttpClient Http = new();

    // Matches the scope SourceOAuthEndpoints now requests for new OneDrive connections. A source
    // connected before this scope upgrade still only has a Files.Read.All-scoped refresh token -
    // uploads to it will fail (Graph returns 403) until the tenant reconnects OneDrive; that
    // failure is handled the same as any other upload failure, by falling back to local storage.
    private const string MicrosoftScope = "Files.ReadWrite offline_access";

    private readonly AppDbContext _db;
    private readonly IOptions<GoogleOAuthOptions> _googleOptions;
    private readonly IOptions<MicrosoftOAuthOptions> _microsoftOptions;
    private readonly ILogger<CloudDocumentTransfer> _logger;

    public CloudDocumentTransfer(
        AppDbContext db,
        IOptions<GoogleOAuthOptions> googleOptions,
        IOptions<MicrosoftOAuthOptions> microsoftOptions,
        ILogger<CloudDocumentTransfer> logger)
    {
        _db = db;
        _googleOptions = googleOptions;
        _microsoftOptions = microsoftOptions;
        _logger = logger;
    }

    public async Task<CloudDocumentResult?> FetchAsync(Guid tenantId, Guid sourceId, string cloudFileId, CancellationToken token)
    {
        var (source, config) = await LoadSourceAsync(tenantId, sourceId, token);
        if (source is null)
        {
            return null;
        }

        var provider = config.GetValueOrDefault("provider");
        var refreshToken = await LoadRefreshTokenAsync(tenantId, sourceId, token);
        if (string.IsNullOrWhiteSpace(refreshToken))
        {
            _logger.LogWarning("No refresh token for source {SourceId}; cannot fetch cloud file {FileId}", sourceId, cloudFileId);
            return null;
        }

        return provider switch
        {
            "gdrive" => await FetchGoogleAsync(refreshToken, cloudFileId, token),
            "onedrive" => await FetchOneDriveAsync(sourceId, tenantId, refreshToken, cloudFileId, token),
            _ => null
        };
    }

    // Google is preferred by default (drive.file's create-in-picked-folder support needs no
    // scope beyond what's already granted); an admin can flip this to prefer OneDrive instead via
    // Tenant.PreferredUploadProvider (see TenantEndpoints.UpdateUploadDestinationAsync). Either
    // way, a source only counts as usable once it has both a folder chosen and a refresh token -
    // "connected but still mid-setup" silently falls through to whatever else is usable, then to
    // the local-storage fallback, exactly like a disconnected source would.
    public async Task<Guid?> ResolveUploadDestinationAsync(Guid tenantId, CancellationToken token)
    {
        var preferred = await _db.Tenants.AsNoTracking()
            .Where(t => t.Id == tenantId)
            .Select(t => t.PreferredUploadProvider)
            .FirstOrDefaultAsync(token);

        var candidates = await _db.Sources.AsNoTracking()
            .Where(s => s.TenantId == tenantId && s.Type == SourceType.CloudImport)
            .ToListAsync(token);

        var usable = new List<(Source Source, string Provider)>();
        foreach (var s in candidates)
        {
            var config = JsonSerializer.Deserialize<Dictionary<string, string>>(s.ConfigJson) ?? new Dictionary<string, string>();
            var provider = config.GetValueOrDefault("provider");
            if (string.IsNullOrWhiteSpace(provider) || string.IsNullOrWhiteSpace(config.GetValueOrDefault("folderId")))
            {
                continue;
            }
            usable.Add((s, provider));
        }

        if (usable.Count == 0)
        {
            return null;
        }

        var usableIds = usable.Select(u => u.Source.Id).ToList();
        var withSecret = await _db.SourceSecrets.AsNoTracking()
            .Where(s => usableIds.Contains(s.SourceId) && s.Key == "refreshToken")
            .Select(s => s.SourceId)
            .ToListAsync(token);
        usable = usable.Where(u => withSecret.Contains(u.Source.Id)).ToList();
        if (usable.Count == 0)
        {
            return null;
        }

        Guid? Pick(string provider) => usable.FirstOrDefault(u => u.Provider == provider).Source?.Id;

        return preferred == "onedrive"
            ? Pick("onedrive") ?? Pick("gdrive")
            : Pick("gdrive") ?? Pick("onedrive");
    }

    public async Task<string?> UploadAsync(Guid tenantId, Guid sourceId, string fileName, string mimeType, Stream content, CancellationToken token)
    {
        var (source, config) = await LoadSourceAsync(tenantId, sourceId, token);
        if (source is null)
        {
            return null;
        }

        var provider = config.GetValueOrDefault("provider");
        var folderId = config.GetValueOrDefault("folderId");
        if (string.IsNullOrWhiteSpace(folderId))
        {
            return null;
        }

        var refreshToken = await LoadRefreshTokenAsync(tenantId, sourceId, token);
        if (string.IsNullOrWhiteSpace(refreshToken))
        {
            return null;
        }

        return provider switch
        {
            "gdrive" => await UploadGoogleAsync(refreshToken, folderId, fileName, mimeType, content, token),
            "onedrive" => await UploadOneDriveAsync(sourceId, tenantId, refreshToken, folderId, fileName, mimeType, content, token),
            _ => null
        };
    }

    private async Task<(Source? Source, Dictionary<string, string> Config)> LoadSourceAsync(Guid tenantId, Guid sourceId, CancellationToken token)
    {
        var source = await _db.Sources.AsNoTracking().FirstOrDefaultAsync(s => s.Id == sourceId && s.TenantId == tenantId, token);
        if (source is null)
        {
            return (null, new Dictionary<string, string>());
        }
        var config = JsonSerializer.Deserialize<Dictionary<string, string>>(source.ConfigJson) ?? new Dictionary<string, string>();
        return (source, config);
    }

    private async Task<string?> LoadRefreshTokenAsync(Guid tenantId, Guid sourceId, CancellationToken token) =>
        await _db.SourceSecrets.AsNoTracking()
            .Where(s => s.SourceId == sourceId && s.TenantId == tenantId && s.Key == "refreshToken")
            .Select(s => s.Value)
            .FirstOrDefaultAsync(token);

    private async Task<string?> GetGoogleAccessTokenAsync(string refreshToken, CancellationToken token)
    {
        var options = _googleOptions.Value;
        if (string.IsNullOrWhiteSpace(options.ClientId) || string.IsNullOrWhiteSpace(options.ClientSecret))
        {
            return null;
        }

        var tokenResp = await Http.PostAsync("https://oauth2.googleapis.com/token", new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["client_id"] = options.ClientId,
            ["client_secret"] = options.ClientSecret,
            ["refresh_token"] = refreshToken,
            ["grant_type"] = "refresh_token"
        }), token);

        if (!tokenResp.IsSuccessStatusCode)
        {
            _logger.LogWarning("Google token refresh failed: {Status}", tokenResp.StatusCode);
            return null;
        }

        var tokenDoc = await tokenResp.Content.ReadFromJsonAsync<GoogleTokenResponse>(cancellationToken: token);
        return tokenDoc?.access_token;
    }

    private async Task<string?> GetMicrosoftAccessTokenAsync(Guid sourceId, Guid tenantId, string refreshToken, CancellationToken token)
    {
        var options = _microsoftOptions.Value;
        if (string.IsNullOrWhiteSpace(options.ClientId) || string.IsNullOrWhiteSpace(options.ClientSecret))
        {
            return null;
        }

        var tokenResp = await Http.PostAsync("https://login.microsoftonline.com/common/oauth2/v2.0/token", new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["client_id"] = options.ClientId,
            ["client_secret"] = options.ClientSecret,
            ["refresh_token"] = refreshToken,
            ["grant_type"] = "refresh_token",
            ["scope"] = MicrosoftScope
        }), token);

        if (!tokenResp.IsSuccessStatusCode)
        {
            _logger.LogWarning("Microsoft token refresh failed: {Status}", tokenResp.StatusCode);
            return null;
        }

        var tokenDoc = await tokenResp.Content.ReadFromJsonAsync<MicrosoftTokenResponse>(cancellationToken: token);
        if (string.IsNullOrWhiteSpace(tokenDoc?.access_token))
        {
            return null;
        }

        // Microsoft rotates the refresh token on every use - the one we just used may already be
        // dead, so whatever comes back here has to be persisted or the next call fails outright.
        // Same reasoning as CloudImportWorker.
        if (!string.IsNullOrWhiteSpace(tokenDoc.refresh_token) && tokenDoc.refresh_token != refreshToken)
        {
            var secret = await _db.SourceSecrets.FirstOrDefaultAsync(
                s => s.SourceId == sourceId && s.TenantId == tenantId && s.Key == "refreshToken", token);
            if (secret is not null)
            {
                secret.Value = tokenDoc.refresh_token;
                await _db.SaveChangesAsync(token);
            }
        }

        return tokenDoc.access_token;
    }

    private async Task<CloudDocumentResult?> FetchGoogleAsync(string refreshToken, string fileId, CancellationToken token)
    {
        var accessToken = await GetGoogleAccessTokenAsync(refreshToken, token);
        if (accessToken is null)
        {
            return null;
        }

        var request = new HttpRequestMessage(HttpMethod.Get, $"https://www.googleapis.com/drive/v3/files/{fileId}?alt=media");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        var fileResp = await Http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, token);
        if (!fileResp.IsSuccessStatusCode)
        {
            _logger.LogWarning("Google Drive file fetch failed for {FileId}: {Status} - it may have been moved, deleted, or access revoked", fileId, fileResp.StatusCode);
            return null;
        }

        return new CloudDocumentResult(await fileResp.Content.ReadAsStreamAsync(token), fileResp.Content.Headers.ContentType?.MediaType);
    }

    private async Task<CloudDocumentResult?> FetchOneDriveAsync(Guid sourceId, Guid tenantId, string refreshToken, string itemId, CancellationToken token)
    {
        var accessToken = await GetMicrosoftAccessTokenAsync(sourceId, tenantId, refreshToken, token);
        if (accessToken is null)
        {
            return null;
        }

        var request = new HttpRequestMessage(HttpMethod.Get, $"https://graph.microsoft.com/v1.0/me/drive/items/{itemId}/content");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        var fileResp = await Http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, token);
        if (!fileResp.IsSuccessStatusCode)
        {
            _logger.LogWarning("OneDrive file fetch failed for {FileId}: {Status} - it may have been moved, deleted, or access revoked", itemId, fileResp.StatusCode);
            return null;
        }

        return new CloudDocumentResult(await fileResp.Content.ReadAsStreamAsync(token), fileResp.Content.Headers.ContentType?.MediaType);
    }

    private async Task<string?> UploadGoogleAsync(string refreshToken, string folderId, string fileName, string mimeType, Stream content, CancellationToken token)
    {
        var accessToken = await GetGoogleAccessTokenAsync(refreshToken, token);
        if (accessToken is null)
        {
            return null;
        }

        var metadataJson = JsonSerializer.Serialize(new { name = fileName, parents = new[] { folderId } });
        using var multipart = new MultipartContent("related");
        multipart.Add(new StringContent(metadataJson, System.Text.Encoding.UTF8, "application/json"));
        var mediaContent = new StreamContent(content);
        mediaContent.Headers.ContentType = new MediaTypeHeaderValue(string.IsNullOrWhiteSpace(mimeType) ? "application/octet-stream" : mimeType);
        multipart.Add(mediaContent);

        var request = new HttpRequestMessage(HttpMethod.Post, "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart")
        {
            Content = multipart
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        var resp = await Http.SendAsync(request, token);
        if (!resp.IsSuccessStatusCode)
        {
            _logger.LogWarning("Google Drive upload failed for {FileName}: {Status}", fileName, resp.StatusCode);
            return null;
        }

        var doc = await resp.Content.ReadFromJsonAsync<GoogleUploadResponse>(cancellationToken: token);
        return doc?.id;
    }

    // Graph's simple upload (PUT .../content) tops out at 4MB - plenty for a single scanned
    // certificate, but a large multi-page scan could exceed it. A failure here (including that
    // one) just returns null, and the caller falls back to archiving locally rather than losing
    // the document - a resumable upload session is more than this is worth building for now.
    private async Task<string?> UploadOneDriveAsync(Guid sourceId, Guid tenantId, string refreshToken, string folderId, string fileName, string mimeType, Stream content, CancellationToken token)
    {
        var accessToken = await GetMicrosoftAccessTokenAsync(sourceId, tenantId, refreshToken, token);
        if (accessToken is null)
        {
            return null;
        }

        var encodedName = Uri.EscapeDataString(fileName);
        var request = new HttpRequestMessage(HttpMethod.Put, $"https://graph.microsoft.com/v1.0/me/drive/items/{folderId}:/{encodedName}:/content")
        {
            Content = new StreamContent(content)
        };
        request.Content.Headers.ContentType = new MediaTypeHeaderValue(string.IsNullOrWhiteSpace(mimeType) ? "application/octet-stream" : mimeType);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        var resp = await Http.SendAsync(request, token);
        if (!resp.IsSuccessStatusCode)
        {
            _logger.LogWarning("OneDrive upload failed for {FileName}: {Status}", fileName, resp.StatusCode);
            return null;
        }

        var doc = await resp.Content.ReadFromJsonAsync<GraphUploadResponse>(cancellationToken: token);
        return doc?.id;
    }

    private sealed class GoogleTokenResponse
    {
        public string? access_token { get; set; }
    }

    private sealed class MicrosoftTokenResponse
    {
        public string? access_token { get; set; }
        public string? refresh_token { get; set; }
    }

    private sealed class GoogleUploadResponse
    {
        public string? id { get; set; }
    }

    private sealed class GraphUploadResponse
    {
        public string? id { get; set; }
    }
}
