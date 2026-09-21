using System.Net.Http.Headers;
using System.Text.Json;
using CertiWatch.Api.Configuration;
using CertiWatch.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace CertiWatch.Api.Infrastructure.Services;

// Fetches a single file live from Google Drive/OneDrive for a Document whose PathOrUrl is a
// "cloudref:{fileId}" reference rather than an archived key in IFileStorage - see
// DocumentIngestionWorker.SetCloudReference for why those documents never get a permanent copy.
// This mirrors the same refresh-token exchange apps/worker's CloudImportWorker already does for
// its periodic folder sync, just for one already-known file id instead of a folder listing.
public interface ICloudDocumentFetcher
{
    Task<CloudDocumentResult?> FetchAsync(Guid tenantId, Guid sourceId, string cloudFileId, CancellationToken token);
}

public sealed record CloudDocumentResult(Stream Content, string? ContentType);

public sealed class CloudDocumentFetcher : ICloudDocumentFetcher
{
    // Same reasoning as SourceOAuthEndpoints.OAuthHttpClient - this API has no IHttpClientFactory
    // registered (minimal API mis-infers an unregistered one as a JSON body parameter), so a
    // shared static client avoids per-call socket exhaustion without needing that registration.
    private static readonly HttpClient Http = new();

    private readonly AppDbContext _db;
    private readonly IOptions<GoogleOAuthOptions> _googleOptions;
    private readonly IOptions<MicrosoftOAuthOptions> _microsoftOptions;
    private readonly ILogger<CloudDocumentFetcher> _logger;

    public CloudDocumentFetcher(
        AppDbContext db,
        IOptions<GoogleOAuthOptions> googleOptions,
        IOptions<MicrosoftOAuthOptions> microsoftOptions,
        ILogger<CloudDocumentFetcher> logger)
    {
        _db = db;
        _googleOptions = googleOptions;
        _microsoftOptions = microsoftOptions;
        _logger = logger;
    }

    public async Task<CloudDocumentResult?> FetchAsync(Guid tenantId, Guid sourceId, string cloudFileId, CancellationToken token)
    {
        var source = await _db.Sources.AsNoTracking().FirstOrDefaultAsync(s => s.Id == sourceId && s.TenantId == tenantId, token);
        if (source is null)
        {
            return null;
        }

        var config = JsonSerializer.Deserialize<Dictionary<string, string>>(source.ConfigJson) ?? new Dictionary<string, string>();
        var provider = config.GetValueOrDefault("provider");

        var refreshToken = await _db.SourceSecrets.AsNoTracking()
            .Where(s => s.SourceId == sourceId && s.TenantId == tenantId && s.Key == "refreshToken")
            .Select(s => s.Value)
            .FirstOrDefaultAsync(token);
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

    private async Task<CloudDocumentResult?> FetchGoogleAsync(string refreshToken, string fileId, CancellationToken token)
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
            _logger.LogWarning("Google token refresh failed fetching file {FileId}: {Status}", fileId, tokenResp.StatusCode);
            return null;
        }

        var tokenDoc = await tokenResp.Content.ReadFromJsonAsync<TokenResponse>(cancellationToken: token);
        if (string.IsNullOrWhiteSpace(tokenDoc?.access_token))
        {
            return null;
        }

        var request = new HttpRequestMessage(HttpMethod.Get, $"https://www.googleapis.com/drive/v3/files/{fileId}?alt=media");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", tokenDoc.access_token);
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
            ["scope"] = "Files.Read.All offline_access"
        }), token);

        if (!tokenResp.IsSuccessStatusCode)
        {
            _logger.LogWarning("Microsoft token refresh failed fetching file {FileId}: {Status}", itemId, tokenResp.StatusCode);
            return null;
        }

        var tokenDoc = await tokenResp.Content.ReadFromJsonAsync<MicrosoftTokenResponse>(cancellationToken: token);
        if (string.IsNullOrWhiteSpace(tokenDoc?.access_token))
        {
            return null;
        }

        // Microsoft rotates the refresh token on every use - the one we just used may already be
        // dead, so whatever comes back here has to be persisted or the next fetch (or the
        // worker's own periodic sync) fails outright. Same reasoning as CloudImportWorker.
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

        var request = new HttpRequestMessage(HttpMethod.Get, $"https://graph.microsoft.com/v1.0/me/drive/items/{itemId}/content");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", tokenDoc.access_token);
        var fileResp = await Http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, token);
        if (!fileResp.IsSuccessStatusCode)
        {
            _logger.LogWarning("OneDrive file fetch failed for {FileId}: {Status} - it may have been moved, deleted, or access revoked", itemId, fileResp.StatusCode);
            return null;
        }

        return new CloudDocumentResult(await fileResp.Content.ReadAsStreamAsync(token), fileResp.Content.Headers.ContentType?.MediaType);
    }

    private sealed class TokenResponse
    {
        public string? access_token { get; set; }
    }

    private sealed class MicrosoftTokenResponse
    {
        public string? access_token { get; set; }
        public string? refresh_token { get; set; }
    }
}
