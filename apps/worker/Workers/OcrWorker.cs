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
    private readonly IDoctrClient _doctr;
    private readonly IDeepSeekClient _deepSeek;
    private readonly ParsingPipeline _pipeline;
    private readonly IApiClient _apiClient;
    private readonly ILogger<OcrWorker> _logger;
    private readonly ConcurrentDictionary<string, DateTime> _processed = new();

    public OcrWorker(
        IOptions<WorkerOptions> options,
        IAzureVisionClient vision,
        ITesseractClient tesseract,
        IDoctrClient doctr,
        IDeepSeekClient deepSeek,
        ParsingPipeline pipeline,
        IApiClient apiClient,
        ILogger<OcrWorker> logger)
    {
        _options = options.Value;
        _vision = vision;
        _tesseract = tesseract;
        _doctr = doctr;
        _deepSeek = deepSeek;
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
                var sanitizedFields = SanitizeFields(fields);
                _logger.LogInformation("Publishing document {File} with fields: {Fields}", file, string.Join(", ", sanitizedFields.Select(kv => $"{kv.Key}={kv.Value}")));
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
                    sanitizedFields,
                    ProcessingStatus.Pending,
                    DateTime.UtcNow);

                await _apiClient.PublishDocumentAsync(payload, token);
            }
        }
    }

    private async Task<string> ExtractTextAsync(string file, CancellationToken token)
    {
        // Step 1: OCR (PaddleOCR > Azure Vision > Tesseract)
        var useAzure = !string.IsNullOrWhiteSpace(_options.AzureVisionEndpoint) &&
                       !string.IsNullOrWhiteSpace(_options.AzureVisionKey);
        var useDoctr = !string.IsNullOrWhiteSpace(_options.DoctrBaseUrl);
        var useDeepSeek = !string.IsNullOrWhiteSpace(_options.DeepSeekApiKey);

        try
        {
            string rawText;

            if (useDoctr)
            {
                try
                {
                    rawText = await _doctr.ExtractTextAsync(file, token);
                    _logger.LogInformation("OCR (Doctr) raw preview: {Preview}", Truncate(rawText, 500));
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Doctr OCR failed for {File}, falling back", file);
                    rawText = string.Empty;
                }
            }
            else if (useAzure)
            {
                rawText = await _vision.ExtractTextAsync(file, token);
                _logger.LogInformation("OCR (Azure Vision) raw preview: {Preview}", Truncate(rawText, 500));
            }
            else
            {
                rawText = await _tesseract.ExtractTextAsync(file, token);
                _logger.LogInformation("OCR (Tesseract) raw preview: {Preview}", Truncate(rawText, 500));
            }

            // Step 2: DeepSeek extraction on raw OCR text
            if (useDeepSeek && !string.IsNullOrWhiteSpace(rawText))
            {
                try
                {
                    var refined = await _deepSeek.ExtractTextAsync(rawText, token);
                    _logger.LogInformation("AI (DeepSeek) response preview: {Preview}", Truncate(refined, 500));
                    if (!string.IsNullOrWhiteSpace(refined))
                    {
                        return refined + Environment.NewLine + rawText;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "DeepSeek extract failed for {File}, falling back to raw OCR", file);
                }
            }

            return rawText;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to extract text for {File}", file);
            return string.Empty;
        }
    }

    private Dictionary<string, string> BuildFields(ParsedDocument parsed)
    {
        var fields = parsed.Result.Fields
            .GroupBy(f => f.Key, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First().Value, StringComparer.OrdinalIgnoreCase);
        var lines = parsed.Lines ?? Array.Empty<string>();
        var normalizedLines = lines.Select(l => l.Trim()).Where(l => !string.IsNullOrWhiteSpace(l)).ToList();
        var lower = (parsed.RawText ?? string.Empty).ToLowerInvariant();

        // Course heuristics
        if (!fields.ContainsKey("course_name"))
        {
            if (lower.Contains("dignity in care"))
            {
                fields["course_name"] = "Dignity in Care";
            }
            if (lower.Contains("autism awareness"))
            {
                if (lower.Contains("level 1"))
                {
                    fields["course_name"] = "Autism Awareness: Level 1";
                }
                else if (lower.Contains("level 2"))
                {
                    fields["course_name"] = "Autism Awareness: Level 2";
                }
                else
                {
                    fields["course_name"] = "Autism Awareness";
                }
            }
            else if (lower.Contains("first aid"))
            {
                fields["course_name"] = "First Aid";
            }
        }

        // Florence / training cert noise cleanup
        if (fields.TryGetValue("course_name", out var noisyCourse))
        {
            if (noisyCourse.Equals("TRAININGCERTIFICATE", StringComparison.OrdinalIgnoreCase) ||
                noisyCourse.Equals("Training Certificate", StringComparison.OrdinalIgnoreCase))
            {
                fields.Remove("course_name");
                if (lower.Contains("dignity in care"))
                {
                    fields["course_name"] = "Dignity in Care";
                }
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
            else if (lower.Contains("florence academy"))
            {
                fields["issuer"] = "Florence Academy";
            }
            else if (fields.TryGetValue("course_name", out var courseValue) &&
                     courseValue.StartsWith("Autism Awareness", StringComparison.OrdinalIgnoreCase))
            {
                fields["issuer"] = "Hull City Council";
            }
        }

        // Florence Academy-style certificates: "course delivered by Florence Academy on <date>"
        for (var i = 0; i < normalizedLines.Count; i++)
        {
            var line = normalizedLines[i];
            var m = Regex.Match(line, @"(?i)course delivered by\s+(?<issuer>.+?)\s+on\s+(?<date>.+)");
            if (m.Success)
            {
                var issuerVal = m.Groups["issuer"].Value.Trim();
                if (!fields.ContainsKey("issuer") && !string.IsNullOrWhiteSpace(issuerVal))
                {
                    fields["issuer"] = issuerVal;
                }

                if (!fields.ContainsKey("issue_date"))
                {
                    var dateText = m.Groups["date"].Value.Trim();
                    if (DateTime.TryParse(dateText, out var dtFlor))
                    {
                        fields["issue_date"] = dtFlor.ToString("yyyy-MM-dd");
                    }
                }

                if (!fields.ContainsKey("course_name") && i > 0)
                {
                    var prev = normalizedLines[i - 1];
                    if (LooksLikeCourse(prev))
                    {
                        fields["course_name"] = prev;
                    }
                }
            }

            if (!fields.ContainsKey("issuer") && line.Contains("florence academy", StringComparison.OrdinalIgnoreCase))
            {
                fields["issuer"] = "Florence Academy";
            }
        }

        // Staff name: prefer the line after "certificate is awarded to", otherwise first plausible Title Case name
        if (fields.TryGetValue("staff_name", out var existingStaff) && !string.IsNullOrWhiteSpace(existingStaff))
        {
            var courseValue = fields.TryGetValue("course_name", out var c0) ? c0 : null;
            if (!string.IsNullOrWhiteSpace(courseValue) &&
                existingStaff.Contains(courseValue, StringComparison.OrdinalIgnoreCase))
            {
                fields.Remove("staff_name");
            }
            else if (existingStaff.Contains("autism", StringComparison.OrdinalIgnoreCase) ||
                     existingStaff.Contains("first aid", StringComparison.OrdinalIgnoreCase))
            {
                fields.Remove("staff_name");
            }
            else if (Regex.IsMatch(existingStaff, @"\d") || Regex.IsMatch(existingStaff, @"^[A-Z0-9]{4,}$"))
            {
                // Drop obvious certificate codes or IDs
                fields.Remove("staff_name");
            }
        }

        if (!fields.ContainsKey("staff_name"))
        {
            var courseValue = fields.TryGetValue("course_name", out var c) ? c : null;

            var awardedMatch = Regex.Match(parsed.RawText ?? string.Empty, @"(?i)certificate\s+is\s+awarded\s+to\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)+)");
            if (awardedMatch.Success)
            {
                var candidate = awardedMatch.Groups[1].Value.Trim();
                if (LooksLikeName(candidate, courseValue))
                {
                    fields["staff_name"] = candidate;
                }
            }

            var awardedIdx = normalizedLines.FindIndex(l =>
                l.Contains("certificate is awarded to", StringComparison.OrdinalIgnoreCase));
            if (awardedIdx >= 0 && awardedIdx + 1 < normalizedLines.Count)
            {
                var candidate = normalizedLines[awardedIdx + 1];
                if (LooksLikeName(candidate, courseValue))
                {
                    fields["staff_name"] = candidate;
                }
            }

            if (!fields.ContainsKey("staff_name"))
            {
                var nameLine = normalizedLines.FirstOrDefault(l => LooksLikeName(l, courseValue));
                if (!string.IsNullOrWhiteSpace(nameLine))
                {
                    fields["staff_name"] = nameLine;
                }
            }
        }

        // Guard against course bleeding into staff field
        if (fields.TryGetValue("staff_name", out var staffVal) &&
            fields.TryGetValue("course_name", out var courseVal2))
        {
            if (staffVal.Equals(courseVal2, StringComparison.OrdinalIgnoreCase) ||
                staffVal.Contains(courseVal2, StringComparison.OrdinalIgnoreCase))
            {
                fields["staff_name"] = "Unknown";
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
                var m = Regex.Match(line, @"(?<month>January|February|March|April|May|June|July|August|September|October|November|December)\s+(?<day>\d{1,2})(?:st|nd|rd|th)?\s+(?<year>\d{4})", RegexOptions.IgnoreCase);
                if (m.Success)
                {
                    if (DateTime.TryParse($"{m.Groups["month"].Value} {m.Groups["day"].Value} {m.Groups["year"].Value}", out var dt2))
                    {
                        fields["issue_date"] = dt2.ToString("yyyy-MM-dd");
                        break;
                    }
                }
            }
        }

        return fields;
    }

    private static Dictionary<string, string> SanitizeFields(Dictionary<string, string> fields)
    {
        var cleaned = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var kv in fields)
        {
            var value = NormalizeText(kv.Value);
            if (!string.IsNullOrWhiteSpace(value))
            {
                cleaned[kv.Key] = value!;
            }
        }

        return cleaned;
    }

    private static string Truncate(string value, int max)
    {
        if (string.IsNullOrEmpty(value)) return value ?? string.Empty;
        return value.Length <= max ? value : value[..max] + "...";
    }

    private static string? NormalizeText(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var cleaned = value.Trim();
        cleaned = cleaned.TrimEnd(',', ';');
        cleaned = TrimQuotes(cleaned);

        cleaned = cleaned.Trim().Trim('"', '\'', '“', '”', '‘', '’');
        cleaned = cleaned.TrimEnd(',', ';').Trim();

        return string.IsNullOrWhiteSpace(cleaned) ? null : cleaned;
    }

    private static string TrimQuotes(string text)
    {
        var quotePairs = new (char start, char end)[]
        {
            ('"', '"'),
            ('“', '”'),
            ('‘', '’'),
            ('\'', '\'')
        };

        foreach (var (start, end) in quotePairs)
        {
            if (text.Length >= 2 && text.StartsWith(start) && text.EndsWith(end))
            {
                return text[1..^1];
            }
        }

        return text;
    }

    private static bool LooksLikeName(string line, string? courseValue)
    {
        if (string.IsNullOrWhiteSpace(line)) return false;
        if (Regex.IsMatch(line, @"\d")) return false;
        if (Regex.IsMatch(line, @"certificate|council|learning|development", RegexOptions.IgnoreCase)) return false;
        if (!string.IsNullOrWhiteSpace(courseValue) && line.Contains(courseValue, StringComparison.OrdinalIgnoreCase)) return false;
        if (line.Contains("Autism", StringComparison.OrdinalIgnoreCase) || line.Contains("First Aid", StringComparison.OrdinalIgnoreCase)) return false;
        if (Regex.IsMatch(line, @"^[A-Z0-9]{4,}$")) return false;
        // Simple Title Case with at least two words
        return Regex.IsMatch(line, @"^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+$");
    }

    private static bool LooksLikeCourse(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return false;
        if (text.Length > 120) return false;
        if (Regex.IsMatch(text, @"certificate|awarded|date|issue|expires|learning|development", RegexOptions.IgnoreCase)) return false;
        var words = text.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var titleish = words.Count(w => Regex.IsMatch(w, @"^[A-Z][A-Za-z0-9\\-]+$"));
        return titleish >= 2;
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
