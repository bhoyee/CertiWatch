using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using CertiWatch.Agent.Options;
using CertiWatch.Agent.Services;
using CertiWatch.Contracts.Enums;
using CertiWatch.Contracts.Events;
using CertiWatch.Contracts.Requests;
using Microsoft.Extensions.Options;

namespace CertiWatch.Agent.Workers;

public sealed class AgentWorker : BackgroundService
{
    private readonly AgentOptions _options;
    private readonly IAgentClient _client;
    private readonly IAgentQueue _queue;
    private readonly ILogger<AgentWorker> _logger;
    private readonly ConcurrentDictionary<string, DateTime> _seen = new(StringComparer.OrdinalIgnoreCase);
    private Guid _deviceId;
    private string _deviceToken = string.Empty;

    public AgentWorker(IOptions<AgentOptions> options, IAgentClient client, IAgentQueue queue, ILogger<AgentWorker> logger)
    {
        _options = options.Value;
        _client = client;
        _queue = queue;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var enrollment = await _client.EnrollAsync(stoppingToken);
        _deviceId = enrollment?.DeviceId ?? Guid.Empty;
        _deviceToken = enrollment?.DeviceToken ?? _options.DeviceName;
        _logger.LogInformation("Agent enrolled as {DeviceId}", _deviceId);

        foreach (var path in _options.WatchPaths)
        {
            if (!Directory.Exists(path))
            {
                Directory.CreateDirectory(path);
            }
            AttachWatcher(path);
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            await FlushQueueAsync(stoppingToken);
            await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
        }
    }

    private void AttachWatcher(string path)
    {
        var watcher = new FileSystemWatcher(path)
        {
            IncludeSubdirectories = true,
            EnableRaisingEvents = true
        };

        watcher.Created += (_, args) => _ = HandleFileAsync(args.FullPath);
        watcher.Changed += (_, args) => _ = HandleFileAsync(args.FullPath);
        _logger.LogInformation("Watching {Path}", path);
    }

    private async Task HandleFileAsync(string file)
    {
        try
        {
            if (!_seen.TryAdd(file, DateTime.UtcNow))
            {
                return;
            }

            await Task.Delay(TimeSpan.FromSeconds(2));
            if (!File.Exists(file))
            {
                return;
            }

            var text = await TryReadTextAsync(file);
            var hash = Convert.ToHexString(SHA256.HashData(await File.ReadAllBytesAsync(file))); // best effort
            var payload = new DocumentDetectedEvent(
                _options.TenantId,
                _options.SourceId,
                _deviceToken,
                Path.GetFileName(file),
                file,
                hash,
                MimeTypes.GetValueOrDefault(Path.GetExtension(file).ToLowerInvariant(), "application/octet-stream"),
                new FileInfo(file).Length,
                Array.Empty<string>(),
                new Dictionary<string, string>
                {
                    ["raw_text"] = text,
                    ["file_name"] = Path.GetFileName(file)
                },
                ProcessingStatus.Pending,
                DateTime.UtcNow);

            await _queue.EnqueueAsync(payload, CancellationToken.None);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to handle file {File}", file);
        }
    }

    private async Task FlushQueueAsync(CancellationToken token)
    {
        var pending = await _queue.FlushAsync(token);
        if (!pending.Any())
        {
            return;
        }

        var request = new DeviceEventRequest
        {
            DeviceId = _deviceId,
            Documents = pending.ToList()
        };

        if (await _client.PushAsync(request, token))
        {
            _logger.LogInformation("Uploaded {Count} documents", pending.Count);
        }
        else
        {
            foreach (var item in pending)
            {
                await _queue.EnqueueAsync(item, token);
            }
        }
    }

    private static async Task<string> TryReadTextAsync(string file)
    {
        try
        {
            return await File.ReadAllTextAsync(file);
        }
        catch
        {
            return Convert.ToBase64String(await File.ReadAllBytesAsync(file));
        }
    }

    private static readonly Dictionary<string, string> MimeTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        [".pdf"] = "application/pdf",
        [".png"] = "image/png",
        [".jpg"] = "image/jpeg",
        [".jpeg"] = "image/jpeg"
    };
}
