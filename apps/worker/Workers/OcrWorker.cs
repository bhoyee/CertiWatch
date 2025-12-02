using System.Collections.Concurrent;
using CertiWatch.Contracts.Enums;
using CertiWatch.Contracts.Events;
using CertiWatch.Parsing;
using CertiWatch.Worker.Options;
using CertiWatch.Worker.Services;
using Microsoft.Extensions.Options;
using System.Text.RegularExpressions;
using CertiWatch.Parsing.Models;

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
                var fields = BuildFields(parsed);
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
                    fields,
                    ProcessingStatus.Pending,
                    DateTime.UtcNow);

                await _apiClient.PublishDocumentAsync(payload, token);
            }
        }
    }

    private async Task<string> ExtractTextAsync(string file, CancellationToken token)
    {
        var useAzure = !string.IsNullOrWhiteSpace(_options.AzureVisionEndpoint) &&
                       !string.IsNullOrWhiteSpace(_options.AzureVisionKey);

        try
        {
            if (useAzure)
            {
                return await _vision.ExtractTextAsync(file, token);
            }

            return await _tesseract.ExtractTextAsync(file, token);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to extract text for {File}", file);
            return string.Empty;
        }
    }

    private Dictionary<string, string> BuildFields(ParsedDocument parsed)
    {
        var fields = parsed.Result.Fields.ToDictionary(f => f.Key, f => f.Value, StringComparer.OrdinalIgnoreCase);
        var lines = parsed.Lines ?? Array.Empty<string>();
        var normalizedLines = lines.Select(l => l.Trim()).Where(l => !string.IsNullOrWhiteSpace(l)).ToList();
        var lower = (parsed.RawText ?? string.Empty).ToLowerInvariant();

        // Course heuristics
        if (!fields.ContainsKey("course_name"))
        {
            if (lower.Contains("autism awareness"))
            {
                fields["course_name"] = "Autism Awareness: Level 2";
            }
            else if (lower.Contains("first aid"))
            {
                fields["course_name"] = "First Aid";
            }
        }

        // Issuer heuristics
        if (!fields.ContainsKey("issuer"))
        {
            if (lower.Contains("hull city council"))
            {
                fields["issuer"] = "Hull City Council";
            }
            else if (lower.Contains("rescueone"))
            {
                fields["issuer"] = "RescueOne";
            }
        }

        // Staff name: first line that looks like a name (Title Case, 2+ words)
        if (!fields.ContainsKey("staff_name"))
        {
            var nameLine = normalizedLines.FirstOrDefault(l => Regex.IsMatch(l, @"^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+$"));
            if (!string.IsNullOrWhiteSpace(nameLine))
            {
                fields["staff_name"] = nameLine;
            }
        }

        // Issue date: first parsable date line
        if (!fields.ContainsKey("issue_date"))
        {
            foreach (var line in normalizedLines)
            {
                if (DateTime.TryParse(line, out var dt))
                {
                    fields["issue_date"] = dt.ToString("yyyy-MM-dd");
                    break;
                }
            }
        }

        return fields;
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
