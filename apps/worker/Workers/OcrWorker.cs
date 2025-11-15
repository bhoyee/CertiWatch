using System.Collections.Concurrent;
using CertiWatch.Contracts.Enums;
using CertiWatch.Contracts.Events;
using CertiWatch.Parsing;
using CertiWatch.Worker.Options;
using CertiWatch.Worker.Services;
using Microsoft.Extensions.Options;

namespace CertiWatch.Worker.Workers;

public sealed class OcrWorker : BackgroundService
{
    private readonly WorkerOptions _options;
    private readonly IAzureVisionClient _vision;
    private readonly ITesseractClient _tesseract;
    private readonly ParsingPipeline _pipeline;
    private readonly IApiClient _apiClient;
    private readonly ILogger<OcrWorker> _logger;
    private readonly ConcurrentDictionary<string, DateTime> _processed = new();

    public OcrWorker(
        IOptions<WorkerOptions> options,
        IAzureVisionClient vision,
        ITesseractClient tesseract,
        ParsingPipeline pipeline,
        IApiClient apiClient,
        ILogger<OcrWorker> logger)
    {
        _options = options.Value;
        _vision = vision;
        _tesseract = tesseract;
        _pipeline = pipeline;
        _apiClient = apiClient;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("CertiWatch worker started. Watching {Paths}", string.Join(",", _options.WatchPaths));
        while (!stoppingToken.IsCancellationRequested)
        {
            await ScanOnceAsync(stoppingToken);
            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
        }
    }

    private async Task ScanOnceAsync(CancellationToken token)
    {
        foreach (var path in _options.WatchPaths)
        {
            if (!Directory.Exists(path))
            {
                _logger.LogWarning("Watch path {Path} not found", path);
                continue;
            }

            var files = Directory.EnumerateFiles(path, "*.*", SearchOption.AllDirectories)
                .Where(f => SupportedExtensions.Contains(Path.GetExtension(f).ToLowerInvariant()));

            foreach (var file in files)
            {
                if (!_processed.TryAdd(file, DateTime.UtcNow))
                {
                    continue;
                }

                var text = await ExtractTextAsync(file, token);
                var fileBytes = await File.ReadAllBytesAsync(file, token);
                var hash = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(fileBytes)).ToLowerInvariant();
                var parsed = _pipeline.Parse(text);
                var payload = new DocumentDetectedEvent(
                    _options.TenantId,
                    _options.SourceId,
                    _options.DeviceToken,
                    Path.GetFileName(file),
                    file,
                    hash,
                    MimeTypes.GetValueOrDefault(Path.GetExtension(file).ToLowerInvariant(), "application/pdf"),
                    new FileInfo(file).Length,
                    parsed.VendorHints,
                    parsed.Result.Fields.ToDictionary(f => f.Key, f => f.Value),
                    ProcessingStatus.Pending,
                    DateTime.UtcNow);

                await _apiClient.PublishDocumentAsync(payload, token);
            }
        }
    }

    private async Task<string> ExtractTextAsync(string file, CancellationToken token)
    {
        try
        {
            return Path.GetExtension(file).Equals(".pdf", StringComparison.OrdinalIgnoreCase)
                ? await _vision.ExtractTextAsync(file, token)
                : await _tesseract.ExtractTextAsync(file, token);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to extract text for {File}", file);
            return string.Empty;
        }
    }

    private static readonly HashSet<string> SupportedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".pdf", ".png", ".jpg", ".jpeg", ".tif", ".tiff"
    };

    private static readonly Dictionary<string, string> MimeTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        [".pdf"] = "application/pdf",
        [".png"] = "image/png",
        [".jpg"] = "image/jpeg",
        [".jpeg"] = "image/jpeg",
        [".tif"] = "image/tiff",
        [".tiff"] = "image/tiff"
    };
}
