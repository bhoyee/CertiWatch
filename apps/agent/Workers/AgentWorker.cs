using System.Collections.Concurrent;
using System.Security.Cryptography;
using CertiWatch.Agent.Options;
using CertiWatch.Agent.Services;
using Microsoft.Extensions.Options;

namespace CertiWatch.Agent.Workers;

public sealed class AgentWorker : BackgroundService
{
    private static readonly TimeSpan RescanInterval = TimeSpan.FromSeconds(60);

    private readonly AgentOptions _options;
    private readonly IAgentClient _client;
    private readonly IProcessedFileStore _processedFiles;
    private readonly IDeviceCredentialStore _credentialStore;
    private readonly ILogger<AgentWorker> _logger;
    private readonly ConcurrentDictionary<string, byte> _inFlight = new(StringComparer.OrdinalIgnoreCase);
    private Guid _deviceId;
    private string _deviceToken = string.Empty;

    public AgentWorker(
        IOptions<AgentOptions> options,
        IAgentClient client,
        IProcessedFileStore processedFiles,
        IDeviceCredentialStore credentialStore,
        ILogger<AgentWorker> logger)
    {
        _options = options.Value;
        _client = client;
        _processedFiles = processedFiles;
        _credentialStore = credentialStore;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await EnsureEnrolledAsync(stoppingToken);

        foreach (var path in _options.WatchPaths)
        {
            try
            {
                if (!Directory.Exists(path))
                {
                    Directory.CreateDirectory(path);
                }
                AttachWatcher(path);
            }
            catch (Exception ex)
            {
                // A single unwatchable path (bad permissions, doesn't exist and can't be created,
                // etc.) must not take the whole service down - the 60s re-scan loop still covers
                // any other configured paths, and this one just logs instead of crashing the host.
                _logger.LogError(ex, "Failed to watch {Path} - check the path exists and is accessible to the account running the service", path);
            }
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            if (_deviceId != Guid.Empty)
            {
                await _client.HeartbeatAsync(_deviceId, _deviceToken, stoppingToken);
                await RescanAsync(stoppingToken);
            }
            await Task.Delay(RescanInterval, stoppingToken);
        }
    }

    // Enrollment only ever needs to happen once per install - enrollment codes are one-time and
    // expire in 24h / get revoked when a new one is minted, so re-enrolling on every restart would
    // break the service permanently once the code is gone, and would silently create a new Device
    // row server-side on every restart in the meantime. Reuse persisted credentials if present.
    private async Task EnsureEnrolledAsync(CancellationToken token)
    {
        var saved = await _credentialStore.LoadAsync(token);
        if (saved is not null)
        {
            _deviceId = saved.DeviceId;
            _deviceToken = saved.DeviceToken;
            _logger.LogInformation("Using previously enrolled device {DeviceId}", _deviceId);
            return;
        }

        var enrollment = await _client.EnrollAsync(token);
        if (enrollment is null)
        {
            _logger.LogError("Agent enrollment failed; the agent cannot upload documents until it is re-enrolled with a valid enrollment code");
            return;
        }

        _deviceId = enrollment.DeviceId;
        _deviceToken = enrollment.DeviceToken;
        await _credentialStore.SaveAsync(new DeviceCredentials(_deviceId, _deviceToken), token);
        _logger.LogInformation("Agent enrolled as {DeviceId}", _deviceId);
    }

    private void AttachWatcher(string path)
    {
        var watcher = new FileSystemWatcher(path)
        {
            IncludeSubdirectories = true,
            EnableRaisingEvents = true
        };

        watcher.Created += (_, args) => _ = HandleFileAsync(args.FullPath, CancellationToken.None);
        watcher.Changed += (_, args) => _ = HandleFileAsync(args.FullPath, CancellationToken.None);
        _logger.LogInformation("Watching {Path}", path);
    }

    private async Task RescanAsync(CancellationToken token)
    {
        foreach (var watchPath in _options.WatchPaths)
        {
            if (!Directory.Exists(watchPath))
            {
                continue;
            }

            IEnumerable<string> files;
            try
            {
                files = Directory.EnumerateFiles(watchPath, "*", SearchOption.AllDirectories);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to scan {Path}", watchPath);
                continue;
            }

            foreach (var file in files)
            {
                await HandleFileAsync(file, token);
            }
        }
    }

    // Handles both watcher events and the periodic re-scan; a file that failed to upload is never
    // marked processed, so the next re-scan pass retries it - this doubles as the retry mechanism.
    private async Task HandleFileAsync(string file, CancellationToken token)
    {
        if (!_inFlight.TryAdd(file, 0))
        {
            return;
        }

        try
        {
            if (!IsAllowedExtension(file))
            {
                return;
            }

            if (!await WaitForFileToSettleAsync(file, token))
            {
                return;
            }

            if (_deviceId == Guid.Empty)
            {
                return;
            }

            var fileInfo = new FileInfo(file);
            if (fileInfo.Length > _options.MaxUploadSizeBytes)
            {
                _logger.LogWarning("Skipping {File}: {Size} bytes exceeds the {Max} byte limit", file, fileInfo.Length, _options.MaxUploadSizeBytes);
                return;
            }

            var hash = await ComputeHashAsync(file, token);
            if (hash is null)
            {
                return;
            }

            if (await _processedFiles.HasProcessedAsync(hash, token))
            {
                return;
            }

            var hashCheck = await _client.CheckHashAsync(_deviceId, _deviceToken, hash, token);
            if (hashCheck is { Exists: true, ShouldReprocess: false })
            {
                await _processedFiles.MarkProcessedAsync(hash, token);
                return;
            }

            var uploaded = await _client.UploadAsync(_deviceId, _deviceToken, _options.SourceId, file, token);
            if (uploaded)
            {
                await _processedFiles.MarkProcessedAsync(hash, token);
                _logger.LogInformation("Uploaded {File}", file);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to handle file {File}", file);
        }
        finally
        {
            _inFlight.TryRemove(file, out _);
        }
    }

    private bool IsAllowedExtension(string file)
    {
        var extension = Path.GetExtension(file);
        return _options.AllowedExtensions.Any(a => a.Equals(extension, StringComparison.OrdinalIgnoreCase));
    }

    // Compares file size across two reads ~1s apart instead of a fixed sleep, so large files on
    // slow drives (network shares, USB) don't get read mid-write.
    private static async Task<bool> WaitForFileToSettleAsync(string file, CancellationToken token)
    {
        try
        {
            if (!File.Exists(file))
            {
                return false;
            }

            var initialSize = new FileInfo(file).Length;
            await Task.Delay(TimeSpan.FromSeconds(1), token);

            if (!File.Exists(file))
            {
                return false;
            }

            var settledSize = new FileInfo(file).Length;
            return initialSize == settledSize;
        }
        catch
        {
            return false;
        }
    }

    private static async Task<string?> ComputeHashAsync(string file, CancellationToken token)
    {
        try
        {
            await using var stream = File.OpenRead(file);
            var hash = await SHA256.HashDataAsync(stream, token);
            return Convert.ToHexString(hash).ToLowerInvariant();
        }
        catch
        {
            return null;
        }
    }
}
