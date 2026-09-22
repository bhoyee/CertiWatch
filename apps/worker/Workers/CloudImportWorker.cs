using System.Collections.Concurrent;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using CertiWatch.Contracts.Dtos;
using CertiWatch.Contracts.Enums;
using CertiWatch.Worker.Options;
using CertiWatch.Worker.Services;
using Microsoft.Extensions.Options;

namespace CertiWatch.Worker.Workers;

// Polls each tenant's connected Google Drive / OneDrive sources and downloads new files into
// CloudImportDownloadPath, where OcrWorker's own filesystem scan picks them up exactly like a
// local upload - no separate cloud-specific OCR path. Both providers only ever get connected
// through a real OAuth consent flow (see apps/api/Features/Sources/SourceOAuthEndpoints.cs); the
// only thing this worker ever holds is the resulting refresh token, never a customer's cloud
// account password or a broad static secret key.
public sealed class CloudImportWorker : BackgroundService
{
    private readonly IApiClient _apiClient;
    private readonly WorkerOptions _options;
    private readonly ILogger<CloudImportWorker> _logger;
    private readonly IHttpClientFactory _httpFactory;
    private readonly ConcurrentDictionary<string, byte> _seenKeys = new(StringComparer.OrdinalIgnoreCase);

    private static readonly string[] SupportedExtensions = [".pdf", ".png", ".jpg", ".jpeg", ".tif", ".tiff"];

    public CloudImportWorker(IApiClient apiClient, IOptions<WorkerOptions> options, ILogger<CloudImportWorker> logger, IHttpClientFactory httpFactory)
    {
        _apiClient = apiClient;
        _options = options.Value;
        _logger = logger;
        _httpFactory = httpFactory;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (_options.CloudImportPollMinutes <= 0)
        {
            _logger.LogInformation("Cloud import polling disabled (CloudImportPollMinutes <= 0).");
            return;
        }

        Directory.CreateDirectory(_options.CloudImportDownloadPath);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await SyncOnceAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Cloud import sync failed");
            }

            try
            {
                await Task.Delay(TimeSpan.FromMinutes(_options.CloudImportPollMinutes), stoppingToken);
            }
            catch (TaskCanceledException)
            {
                break;
            }
        }
    }

    private async Task SyncOnceAsync(CancellationToken token)
    {
        var sources = await _apiClient.GetSourcesAsync(_options.DeviceId, _options.DeviceToken, token);
        foreach (var source in sources.Where(s => s.Type == SourceType.CloudImport))
        {
            var provider = source.Config.TryGetValue("provider", out var p) ? p?.Trim().ToLowerInvariant() : null;
            if (string.IsNullOrWhiteSpace(provider))
            {
                _logger.LogWarning("Source {Source} missing provider; skipping", source.DisplayName);
                continue;
            }

            try
            {
                SyncResult result;
                switch (provider)
                {
                    case "gdrive":
                        result = await SyncGoogleDriveAsync(source, token);
                        break;
                    case "onedrive":
                        result = await SyncOneDriveAsync(source, token);
                        break;
                    default:
                        _logger.LogWarning("Provider {Provider} not supported for source {Source}", provider, source.DisplayName);
                        result = SyncResult.Error($"Provider {provider} not supported");
                        break;
                }

                // Skipped (not configured yet - no folder chosen, no refresh token) deliberately
                // leaves the status alone rather than reporting "ok" or "error" - a source that's
                // simply mid-setup shouldn't flash a false success or an alarming failure.
                if (result.Status is not null)
                {
                    await _apiClient.ReportSourceSyncAsync(_options.DeviceId, _options.DeviceToken, source.Id, result.Status, result.Message, token);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed syncing source {Source}", source.DisplayName);
                await _apiClient.ReportSourceSyncAsync(_options.DeviceId, _options.DeviceToken, source.Id, "error", ex.Message, token);
            }
        }
    }

    // Sync*Async methods return one of these instead of reporting their own status directly - the
    // earlier version had each method call ReportSourceSyncAsync("error", ...) on a soft failure
    // and then return normally, only for the caller here to immediately overwrite that with "ok"
    // right after since no exception had been thrown - a failed sync was silently shown as
    // succeeding on the Sources page.
    private readonly record struct SyncResult(string? Status, string? Message)
    {
        public static SyncResult Ok() => new("ok", null);
        public static SyncResult Error(string message) => new("error", message);
        public static SyncResult Skipped() => new(null, null);
    }

    private async Task<SyncResult> SyncGoogleDriveAsync(SourceDto source, CancellationToken token)
    {
        if (!source.Config.TryGetValue("refreshToken", out var refreshToken) || string.IsNullOrWhiteSpace(refreshToken))
        {
            _logger.LogWarning("Google Drive source {Source} has no refresh token - reconnect required", source.DisplayName);
            return SyncResult.Skipped();
        }

        if (!source.Config.TryGetValue("folderId", out var folderId) || string.IsNullOrWhiteSpace(folderId))
        {
            _logger.LogInformation("Google Drive source {Source} has no folder selected yet; skipping", source.DisplayName);
            return SyncResult.Skipped();
        }

        if (string.IsNullOrWhiteSpace(_options.GoogleOAuthClientId) || string.IsNullOrWhiteSpace(_options.GoogleOAuthClientSecret))
        {
            _logger.LogWarning("Google OAuth client not configured on the worker; cannot sync {Source}", source.DisplayName);
            return SyncResult.Skipped();
        }

        var http = _httpFactory.CreateClient("cloud-sync");

        var tokenResp = await http.PostAsync("https://oauth2.googleapis.com/token", new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["client_id"] = _options.GoogleOAuthClientId,
            ["client_secret"] = _options.GoogleOAuthClientSecret,
            ["refresh_token"] = refreshToken,
            ["grant_type"] = "refresh_token"
        }), token);

        if (!tokenResp.IsSuccessStatusCode)
        {
            var body = await tokenResp.Content.ReadAsStringAsync(token);
            _logger.LogWarning("Google token refresh failed for {Source}: {Status} {Body}", source.DisplayName, tokenResp.StatusCode, body);
            return SyncResult.Error("Google authorization expired - please reconnect this source");
        }

        var tokenDoc = await tokenResp.Content.ReadFromJsonAsync<GoogleTokenResponse>(cancellationToken: token);
        if (string.IsNullOrWhiteSpace(tokenDoc?.access_token))
        {
            _logger.LogWarning("Google token refresh returned no access token for {Source}", source.DisplayName);
            return SyncResult.Error("Google didn't return an access token");
        }

        http.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", tokenDoc.access_token);

        string? pageToken = null;
        do
        {
            var q = Uri.EscapeDataString($"'{folderId}' in parents and trashed = false");
            var url = $"https://www.googleapis.com/drive/v3/files?q={q}&fields=nextPageToken,files(id,name,mimeType)&pageSize=200"
                + (pageToken is null ? string.Empty : $"&pageToken={Uri.EscapeDataString(pageToken)}");

            var listResp = await http.GetAsync(url, token);
            if (!listResp.IsSuccessStatusCode)
            {
                var body = await listResp.Content.ReadAsStringAsync(token);
                _logger.LogWarning("Google Drive list failed for {Source}: {Status} {Body}", source.DisplayName, listResp.StatusCode, body);
                return SyncResult.Error(
                    listResp.StatusCode == System.Net.HttpStatusCode.NotFound
                        ? "Folder not found - check the folder ID is correct and this account has access to it"
                        : $"list failed {listResp.StatusCode}");
            }

            var listDoc = await listResp.Content.ReadFromJsonAsync<GoogleDriveListResponse>(cancellationToken: token);
            if (listDoc?.files is null) return SyncResult.Ok();

            foreach (var file in listDoc.files)
            {
                // v1 is deliberately non-recursive: a folder full of unrelated subfolders getting
                // silently pulled in whole would be surprising, and Drive's API makes recursion an
                // opt-in tree walk rather than a single flag.
                if (file.mimeType == "application/vnd.google-apps.folder") continue;
                if (string.IsNullOrWhiteSpace(file.id) || string.IsNullOrWhiteSpace(file.name)) continue;
                if (!IsSupportedExtension(file.name)) continue;

                var keyId = $"{source.Id}:{file.id}";
                if (!_seenKeys.TryAdd(keyId, 0)) continue;

                var destPath = GetDestinationPath(source.Id, file.id, file.name);
                Directory.CreateDirectory(Path.GetDirectoryName(destPath)!);

                _logger.LogInformation("Downloading Google Drive file {Name} to {Dest}", file.name, destPath);
                using var fileResp = await http.GetAsync($"https://www.googleapis.com/drive/v3/files/{file.id}?alt=media", token);
                if (!fileResp.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Google Drive download failed for {Name} with {Status}", file.name, fileResp.StatusCode);
                    continue;
                }

                await using var outStream = File.Create(destPath);
                await fileResp.Content.CopyToAsync(outStream, token);
            }

            pageToken = listDoc.nextPageToken;
        } while (!string.IsNullOrEmpty(pageToken) && !token.IsCancellationRequested);

        return SyncResult.Ok();
    }

    private async Task<SyncResult> SyncOneDriveAsync(SourceDto source, CancellationToken token)
    {
        if (!source.Config.TryGetValue("refreshToken", out var refreshToken) || string.IsNullOrWhiteSpace(refreshToken))
        {
            _logger.LogWarning("OneDrive source {Source} has no refresh token - reconnect required", source.DisplayName);
            return SyncResult.Skipped();
        }

        if (!source.Config.TryGetValue("folderId", out var folderId) || string.IsNullOrWhiteSpace(folderId))
        {
            _logger.LogInformation("OneDrive source {Source} has no folder selected yet; skipping", source.DisplayName);
            return SyncResult.Skipped();
        }

        if (string.IsNullOrWhiteSpace(_options.MicrosoftOAuthClientId) || string.IsNullOrWhiteSpace(_options.MicrosoftOAuthClientSecret))
        {
            _logger.LogWarning("Microsoft OAuth client not configured on the worker; cannot sync {Source}", source.DisplayName);
            return SyncResult.Skipped();
        }

        var http = _httpFactory.CreateClient("cloud-sync");

        var tokenResp = await http.PostAsync("https://login.microsoftonline.com/common/oauth2/v2.0/token", new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["client_id"] = _options.MicrosoftOAuthClientId,
            ["client_secret"] = _options.MicrosoftOAuthClientSecret,
            ["refresh_token"] = refreshToken,
            ["grant_type"] = "refresh_token",
            // Matches SourceOAuthEndpoints.MicrosoftScope (apps/api) - Files.ReadWrite, not
            // Files.Read.All, now that a staff upload/upload-link file can be written into a
            // connected OneDrive folder (see CloudDocumentTransfer.UploadAsync).
            ["scope"] = "Files.ReadWrite offline_access"
        }), token);

        if (!tokenResp.IsSuccessStatusCode)
        {
            var body = await tokenResp.Content.ReadAsStringAsync(token);
            _logger.LogWarning("Microsoft token refresh failed for {Source}: {Status} {Body}", source.DisplayName, tokenResp.StatusCode, body);
            return SyncResult.Error("Microsoft authorization expired - please reconnect this source");
        }

        var tokenDoc = await tokenResp.Content.ReadFromJsonAsync<MicrosoftTokenResponse>(cancellationToken: token);
        if (string.IsNullOrWhiteSpace(tokenDoc?.access_token))
        {
            _logger.LogWarning("Microsoft token refresh returned no access token for {Source}", source.DisplayName);
            return SyncResult.Error("Microsoft didn't return an access token");
        }

        // Microsoft rotates the refresh token on every use - the one we just used may already be
        // dead, so whatever comes back here has to be persisted or the next sync fails outright.
        if (!string.IsNullOrWhiteSpace(tokenDoc.refresh_token) && tokenDoc.refresh_token != refreshToken)
        {
            await _apiClient.UpdateSourceSecretAsync(_options.DeviceId, _options.DeviceToken, source.Id, "refreshToken", tokenDoc.refresh_token, token);
        }

        http.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", tokenDoc.access_token);

        var url = $"https://graph.microsoft.com/v1.0/me/drive/items/{folderId}/children?$select=id,name,file,@microsoft.graph.downloadUrl";
        while (!string.IsNullOrEmpty(url))
        {
            var listResp = await http.GetAsync(url, token);
            if (!listResp.IsSuccessStatusCode)
            {
                var body = await listResp.Content.ReadAsStringAsync(token);
                _logger.LogWarning("OneDrive list failed for {Source}: {Status} {Body}", source.DisplayName, listResp.StatusCode, body);
                return SyncResult.Error(
                    listResp.StatusCode == System.Net.HttpStatusCode.NotFound
                        ? "Folder not found - check the folder ID is correct and this account has access to it"
                        : $"list failed {listResp.StatusCode}");
            }

            var listDoc = await listResp.Content.ReadFromJsonAsync<GraphListResponse>(cancellationToken: token);
            if (listDoc?.value is null) return SyncResult.Ok();

            foreach (var item in listDoc.value)
            {
                // Same non-recursive v1 choice as Google Drive above - a folder item has no "file"
                // facet in Graph's response, which is how we tell the two apart.
                if (item.file is null) continue;
                if (string.IsNullOrWhiteSpace(item.name) || string.IsNullOrWhiteSpace(item.downloadUrl)) continue;
                if (string.IsNullOrWhiteSpace(item.id)) continue;
                if (!IsSupportedExtension(item.name)) continue;

                var keyId = $"{source.Id}:{item.id}";
                if (!_seenKeys.TryAdd(keyId, 0)) continue;

                var destPath = GetDestinationPath(source.Id, item.id, item.name);
                Directory.CreateDirectory(Path.GetDirectoryName(destPath)!);

                _logger.LogInformation("Downloading OneDrive file {Name} to {Dest}", item.name, destPath);
                using var fileResp = await http.GetAsync(item.downloadUrl, token);
                if (!fileResp.IsSuccessStatusCode)
                {
                    _logger.LogWarning("OneDrive download failed for {Name} with {Status}", item.name, fileResp.StatusCode);
                    continue;
                }

                await using var outStream = File.Create(destPath);
                await fileResp.Content.CopyToAsync(outStream, token);
            }

            url = listDoc.nextLink ?? string.Empty;
        }

        return SyncResult.Ok();
    }

    // The provider's file id gets its own path segment (not a filename prefix) so
    // OcrWorker.ResolveCloudFileId can recover it later, and so the file's display name - read
    // straight off this path elsewhere in the pipeline - stays exactly what it was in Drive/
    // OneDrive, with no id text to strip back out.
    private string GetDestinationPath(Guid sourceId, string fileId, string fileName)
    {
        var safeName = fileName.Replace("..", string.Empty).Replace('/', '_').Replace('\\', '_');
        var safeFileId = fileId.Replace("..", string.Empty).Replace('/', '_').Replace('\\', '_');
        return Path.Combine(_options.CloudImportDownloadPath, sourceId.ToString(), safeFileId, safeName);
    }

    private static bool IsSupportedExtension(string path)
    {
        var ext = Path.GetExtension(path);
        return SupportedExtensions.Contains(ext, StringComparer.OrdinalIgnoreCase);
    }

    private sealed class GoogleTokenResponse
    {
        public string? access_token { get; set; }
        public int expires_in { get; set; }
    }

    private sealed class GoogleDriveFile
    {
        public string? id { get; set; }
        public string? name { get; set; }
        public string? mimeType { get; set; }
    }

    private sealed class GoogleDriveListResponse
    {
        public List<GoogleDriveFile>? files { get; set; }
        public string? nextPageToken { get; set; }
    }

    private sealed class MicrosoftTokenResponse
    {
        public string? access_token { get; set; }
        public string? refresh_token { get; set; }
        public int expires_in { get; set; }
    }

    private sealed class GraphDriveItem
    {
        public string? id { get; set; }
        public string? name { get; set; }
        public object? file { get; set; }

        [JsonPropertyName("@microsoft.graph.downloadUrl")]
        public string? downloadUrl { get; set; }
    }

    private sealed class GraphListResponse
    {
        public List<GraphDriveItem>? value { get; set; }

        [JsonPropertyName("@odata.nextLink")]
        public string? nextLink { get; set; }
    }
}
