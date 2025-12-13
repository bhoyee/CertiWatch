using System.Collections.Concurrent;
using System.Net;
using System.Text.RegularExpressions;
using Amazon;
using Amazon.S3;
using Amazon.S3.Model;
using CertiWatch.Contracts.Dtos;
using CertiWatch.Contracts.Enums;
using CertiWatch.Worker.Options;
using CertiWatch.Worker.Services;
using Microsoft.Extensions.Options;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Google.Cloud.Storage.V1;
using Google.Apis.Auth.OAuth2;

namespace CertiWatch.Worker.Workers;

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
                switch (provider)
                {
                    case "s3":
                    case "minio":
                        await SyncS3Async(source, token);
                        await _apiClient.ReportSourceSyncAsync(_options.DeviceId, _options.DeviceToken, source.Id, "ok", null, token);
                        break;
                    case "webdav":
                    case "httpdir":
                    case "http":
                        await SyncWebDavAsync(source, token);
                        await _apiClient.ReportSourceSyncAsync(_options.DeviceId, _options.DeviceToken, source.Id, "ok", null, token);
                        break;
                    case "dropbox":
                        await SyncDropboxAsync(source, token);
                        await _apiClient.ReportSourceSyncAsync(_options.DeviceId, _options.DeviceToken, source.Id, "ok", null, token);
                        break;
                    case "gcs":
                        await SyncGcsAsync(source, token);
                        await _apiClient.ReportSourceSyncAsync(_options.DeviceId, _options.DeviceToken, source.Id, "ok", null, token);
                        break;
                    case "azure":
                        await SyncAzureAsync(source, token);
                        await _apiClient.ReportSourceSyncAsync(_options.DeviceId, _options.DeviceToken, source.Id, "ok", null, token);
                        break;
                    case "gdrive":
                    case "onedrive":
                        await SyncNotImplementedAsync(source, token, provider);
                        break;
                    default:
                        _logger.LogWarning("Provider {Provider} not yet implemented for source {Source}", provider, source.DisplayName);
                        await _apiClient.ReportSourceSyncAsync(_options.DeviceId, _options.DeviceToken, source.Id, "unsupported", $"Provider {provider} not implemented", token);
                        break;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed syncing source {Source}", source.DisplayName);
                await _apiClient.ReportSourceSyncAsync(_options.DeviceId, _options.DeviceToken, source.Id, "error", ex.Message, token);
            }
        }
    }

    private async Task SyncS3Async(SourceDto source, CancellationToken token)
    {
        if (!source.Config.TryGetValue("bucket", out var bucket) || string.IsNullOrWhiteSpace(bucket))
        {
            _logger.LogWarning("S3 source {Source} missing bucket", source.DisplayName);
            return;
        }

        source.Config.TryGetValue("prefix", out var prefix);
        var region = source.Config.TryGetValue("region", out var r) ? r : "us-east-1";
        source.Config.TryGetValue("endpoint", out var endpoint);

        var accessKey = source.Config.TryGetValue("accessKey", out var ak) ? ak : null;
        var secretKey = source.Config.TryGetValue("secretKey", out var sk) ? sk : null;
        if (string.IsNullOrWhiteSpace(accessKey) || string.IsNullOrWhiteSpace(secretKey))
        {
            _logger.LogWarning("S3 source {Source} missing credentials", source.DisplayName);
            return;
        }

        var config = new AmazonS3Config
        {
            RegionEndpoint = RegionEndpoint.GetBySystemName(region),
            Timeout = TimeSpan.FromMinutes(2),
            MaxErrorRetry = 1
        };
        if (!string.IsNullOrWhiteSpace(endpoint))
        {
            config.ServiceURL = endpoint;
            config.ForcePathStyle = true;
        }

        using var s3 = new AmazonS3Client(accessKey, secretKey, config);
        var listReq = new ListObjectsV2Request
        {
            BucketName = bucket,
            Prefix = prefix
        };

        ListObjectsV2Response? listResp;
        do
        {
            listResp = await s3.ListObjectsV2Async(listReq, token);
            foreach (var obj in listResp.S3Objects.Where(o => o.Size > 0))
            {
                if (!IsSupportedExtension(obj.Key)) continue;

                var keyId = $"{source.Id}:{obj.Key}";
                if (!_seenKeys.TryAdd(keyId, 0))
                {
                    continue;
                }

                var destPath = GetDestinationPath(source.Id, Path.GetFileName(obj.Key));
                Directory.CreateDirectory(Path.GetDirectoryName(destPath)!);

                _logger.LogInformation("Downloading {Key} from {Bucket} to {Dest}", obj.Key, bucket, destPath);
                var getReq = new GetObjectRequest { BucketName = bucket, Key = obj.Key };
                using var resp = await s3.GetObjectAsync(getReq, token);
                await using var outStream = File.Create(destPath);
                await resp.ResponseStream.CopyToAsync(outStream, token);
            }

            listReq.ContinuationToken = listResp.IsTruncated ? listResp.NextContinuationToken : null;
        } while (!string.IsNullOrEmpty(listReq.ContinuationToken) && !token.IsCancellationRequested);
    }

    private async Task SyncWebDavAsync(SourceDto source, CancellationToken token)
    {
        if (!source.Config.TryGetValue("baseUrl", out var baseUrl) || string.IsNullOrWhiteSpace(baseUrl))
        {
            _logger.LogWarning("WebDAV source {Source} missing baseUrl", source.DisplayName);
            return;
        }

        var path = source.Config.TryGetValue("path", out var p) ? p : string.Empty;
        var username = source.Config.TryGetValue("username", out var u) ? u : null;
        var password = source.Config.TryGetValue("password", out var pw) ? pw : null;

        var http = _httpFactory.CreateClient("cloud-sync");
        if (!string.IsNullOrWhiteSpace(username) && password is not null)
        {
            var creds = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes($"{username}:{password}"));
            http.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Basic", creds);
        }

        var listUrl = CombineUrl(baseUrl, path);
        var listResp = await http.GetAsync(listUrl, token);
        if (!listResp.IsSuccessStatusCode)
        {
            _logger.LogWarning("WebDAV listing failed for {Url} with {Status}", listUrl, listResp.StatusCode);
            return;
        }

        var body = await listResp.Content.ReadAsStringAsync(token);
        var links = ExtractLinks(listUrl, body);
        foreach (var link in links)
        {
            if (!IsSupportedExtension(link)) continue;

            var keyId = $"{source.Id}:{link}";
            if (!_seenKeys.TryAdd(keyId, 0))
            {
                continue;
            }

            var fileName = Path.GetFileName(new Uri(link).LocalPath);
            var destPath = GetDestinationPath(source.Id, fileName);
            Directory.CreateDirectory(Path.GetDirectoryName(destPath)!);

            _logger.LogInformation("Downloading {Url} to {Dest}", link, destPath);
            using var fileResp = await http.GetAsync(link, token);
            if (!fileResp.IsSuccessStatusCode)
            {
                _logger.LogWarning("Download failed for {Url} with {Status}", link, fileResp.StatusCode);
                continue;
            }

            await using var outStream = File.Create(destPath);
            await fileResp.Content.CopyToAsync(outStream, token);
        }
    }

    private async Task SyncDropboxAsync(SourceDto source, CancellationToken token)
    {
        if (!source.Config.TryGetValue("accessToken", out var accessToken) || string.IsNullOrWhiteSpace(accessToken))
        {
            _logger.LogWarning("Dropbox source {Source} missing accessToken", source.DisplayName);
            return;
        }

        var path = source.Config.TryGetValue("path", out var p) ? p : string.Empty;
        var http = _httpFactory.CreateClient("cloud-sync");
        http.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);

        // List folder
        var listReqPayload = new
        {
            path = string.IsNullOrWhiteSpace(path) ? string.Empty : path,
            recursive = false,
            include_media_info = false,
            include_deleted = false
        };
        var listReq = new HttpRequestMessage(HttpMethod.Post, "https://api.dropboxapi.com/2/files/list_folder")
        {
            Content = new StringContent(System.Text.Json.JsonSerializer.Serialize(listReqPayload), System.Text.Encoding.UTF8, "application/json")
        };
        var listResp = await http.SendAsync(listReq, token);

        if (!listResp.IsSuccessStatusCode)
        {
            var err = await listResp.Content.ReadAsStringAsync(token);
            _logger.LogWarning("Dropbox list failed for {Source} with {Status}: {Err}", source.DisplayName, listResp.StatusCode, err);
            await _apiClient.ReportSourceSyncAsync(_options.DeviceId, _options.DeviceToken, source.Id, "error", $"list failed {listResp.StatusCode}", token);
            return;
        }

        var json = await listResp.Content.ReadAsStringAsync(token);
        DropboxListResult? listDoc = null;
        try
        {
            listDoc = System.Text.Json.JsonSerializer.Deserialize<DropboxListResult>(json);
        }
        catch (Exception)
        {
            _logger.LogWarning("Failed to parse Dropbox list response");
        }

        if (listDoc?.entries is null) return;

        foreach (var entry in listDoc.entries.Where(e => e[".tag"] == "file"))
        {
            if (!entry.TryGetValue("path_lower", out var lower) || string.IsNullOrWhiteSpace(lower)) continue;
            var filePath = lower!;
            if (!IsSupportedExtension(filePath)) continue;

            var keyId = $"{source.Id}:{filePath}";
            if (!_seenKeys.TryAdd(keyId, 0))
            {
                continue;
            }

            var fileName = Path.GetFileName(filePath);
            var destPath = GetDestinationPath(source.Id, fileName);
            Directory.CreateDirectory(Path.GetDirectoryName(destPath)!);

            _logger.LogInformation("Downloading Dropbox file {Path} to {Dest}", filePath, destPath);
            var downloadReq = new HttpRequestMessage(HttpMethod.Post, "https://content.dropboxapi.com/2/files/download");
            downloadReq.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
            downloadReq.Headers.Add("Dropbox-API-Arg", System.Text.Json.JsonSerializer.Serialize(new { path = filePath }));

            using var dlResp = await http.SendAsync(downloadReq, token);
            if (!dlResp.IsSuccessStatusCode)
            {
                _logger.LogWarning("Dropbox download failed for {File} with {Status}", filePath, dlResp.StatusCode);
                continue;
            }

            await using var outStream = File.Create(destPath);
            await dlResp.Content.CopyToAsync(outStream, token);
        }
    }

    private async Task SyncNotImplementedAsync(SourceDto source, CancellationToken token, string provider)
    {
        _logger.LogWarning("Provider {Provider} is declared but not yet implemented; skipping source {Source}", provider, source.DisplayName);
        await _apiClient.ReportSourceSyncAsync(_options.DeviceId, _options.DeviceToken, source.Id, "unsupported", $"Provider {provider} not implemented", token);
    }

    private async Task SyncAzureAsync(SourceDto source, CancellationToken token)
    {
        var connectionString = source.Config.TryGetValue("connectionString", out var cs) ? cs : null;
        BlobContainerClient? containerClient = null;

        if (!string.IsNullOrWhiteSpace(connectionString))
        {
            if (!source.Config.TryGetValue("container", out var container) || string.IsNullOrWhiteSpace(container))
            {
                _logger.LogWarning("Azure source {Source} missing container", source.DisplayName);
                return;
            }
            containerClient = new BlobContainerClient(connectionString, container);
        }
        else
        {
            if (!source.Config.TryGetValue("accountName", out var account) ||
                !source.Config.TryGetValue("accountKey", out var key) ||
                string.IsNullOrWhiteSpace(account) ||
                string.IsNullOrWhiteSpace(key))
            {
                _logger.LogWarning("Azure source {Source} missing credentials", source.DisplayName);
                return;
            }
            if (!source.Config.TryGetValue("container", out var container) || string.IsNullOrWhiteSpace(container))
            {
                _logger.LogWarning("Azure source {Source} missing container", source.DisplayName);
                return;
            }

            var uri = new Uri($"https://{account}.blob.core.windows.net/{container}");
            var creds = new Azure.Storage.StorageSharedKeyCredential(account, key);
            containerClient = new BlobContainerClient(uri, creds);
        }

        var prefix = source.Config.TryGetValue("prefix", out var pref) ? pref : null;

        await foreach (BlobItem blob in containerClient.GetBlobsAsync(prefix: prefix, cancellationToken: token))
        {
            if (blob.Properties.ContentLength is null || blob.Properties.ContentLength == 0) continue;
            if (!IsSupportedExtension(blob.Name)) continue;

            var keyId = $"{source.Id}:{blob.Name}";
            if (!_seenKeys.TryAdd(keyId, 0))
            {
                continue;
            }

            var destPath = GetDestinationPath(source.Id, Path.GetFileName(blob.Name));
            Directory.CreateDirectory(Path.GetDirectoryName(destPath)!);

            _logger.LogInformation("Downloading Azure blob {Blob} to {Dest}", blob.Name, destPath);
            var client = containerClient.GetBlobClient(blob.Name);
            await using var stream = File.Create(destPath);
            await client.DownloadToAsync(stream, token);
        }
    }

    private async Task SyncGcsAsync(SourceDto source, CancellationToken token)
    {
        if (!source.Config.TryGetValue("bucket", out var bucket) || string.IsNullOrWhiteSpace(bucket))
        {
            _logger.LogWarning("GCS source {Source} missing bucket", source.DisplayName);
            return;
        }

        if (!source.Config.TryGetValue("serviceAccount", out var serviceAccountJson) || string.IsNullOrWhiteSpace(serviceAccountJson))
        {
            _logger.LogWarning("GCS source {Source} missing serviceAccount json", source.DisplayName);
            return;
        }

        GoogleCredential credential;
        try
        {
            credential = GoogleCredential.FromJson(serviceAccountJson);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Invalid service account json for source {Source}", source.DisplayName);
            return;
        }

        var storage = StorageClient.Create(credential);
        var prefix = source.Config.TryGetValue("prefix", out var pref) ? pref : null;

        var objects = storage.ListObjects(bucket, prefix);
        foreach (var obj in objects)
        {
            if (obj.Size == null || obj.Size == 0) continue;
            if (!IsSupportedExtension(obj.Name)) continue;

            var keyId = $"{source.Id}:{obj.Name}";
            if (!_seenKeys.TryAdd(keyId, 0))
            {
                continue;
            }

            var destPath = GetDestinationPath(source.Id, Path.GetFileName(obj.Name));
            Directory.CreateDirectory(Path.GetDirectoryName(destPath)!);

            _logger.LogInformation("Downloading GCS object {Object} to {Dest}", obj.Name, destPath);
            await using var stream = File.Create(destPath);
            await storage.DownloadObjectAsync(bucket, obj.Name, stream, cancellationToken: token);
        }
    }

    private string GetDestinationPath(Guid sourceId, string fileName)
    {
        var safeName = fileName.Replace("..", string.Empty).Replace('/', '_').Replace('\\', '_');
        return Path.Combine(_options.CloudImportDownloadPath, sourceId.ToString(), safeName);
    }

    private static bool IsSupportedExtension(string path)
    {
        var ext = Path.GetExtension(path);
        return SupportedExtensions.Contains(ext, StringComparer.OrdinalIgnoreCase);
    }

    private static string CombineUrl(string baseUrl, string? path)
    {
        if (string.IsNullOrWhiteSpace(path)) return baseUrl;
        if (path.StartsWith("http", StringComparison.OrdinalIgnoreCase)) return path;
        return $"{baseUrl.TrimEnd('/')}/{path.TrimStart('/')}";
    }

    private static IEnumerable<string> ExtractLinks(string baseUrl, string html)
    {
        var matches = Regex.Matches(html, @"href\s*=\s*[""'](?<url>[^""']+)[""']", RegexOptions.IgnoreCase);
        foreach (Match match in matches)
        {
            var url = match.Groups["url"].Value;
            if (string.IsNullOrWhiteSpace(url)) continue;
            if (!url.StartsWith("http", StringComparison.OrdinalIgnoreCase))
            {
                url = CombineUrl(baseUrl, url);
            }
            yield return url;
        }
    }

    private sealed class DropboxListResult
    {
        public List<Dictionary<string, string>> entries { get; set; } = new();
    }
}
