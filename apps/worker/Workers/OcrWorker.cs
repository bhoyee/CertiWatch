using System.Collections.Concurrent;
using CertiWatch.Contracts.Enums;
using CertiWatch.Contracts.Events;
using CertiWatch.Parsing;
using CertiWatch.Worker.Options;
using CertiWatch.Worker.Services;
using Microsoft.Extensions.Options;
using System.Text.RegularExpressions;
using CertiWatch.Parsing.Models;
using System.Diagnostics;
using System.Text.Json;
using System.Globalization;

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
                var fields = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

                // Structured DeepSeek extraction first
                StructuredExtractionResult? structured = null;
                try
                {
                    structured = await _deepSeek.ExtractStructuredAsync(text, _options.DocumentType, token);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "DeepSeek structured extract failed for {File}", file);
                }

                if (structured is not null)
                {
                    if (!string.IsNullOrWhiteSpace(structured.StaffName)) fields["staff_name"] = structured.StaffName!;
                    if (!string.IsNullOrWhiteSpace(structured.CourseName)) fields["course_name"] = structured.CourseName!;
                    if (!string.IsNullOrWhiteSpace(structured.Issuer)) fields["issuer"] = structured.Issuer!;
                    if (!string.IsNullOrWhiteSpace(structured.IssueDate)) fields["issue_date"] = structured.IssueDate!;
                    if (!string.IsNullOrWhiteSpace(structured.ExpiryDate)) fields["expiry_date"] = structured.ExpiryDate!;
                }

                // Heuristic/keyword backup
                var heuristicFields = BuildFields(parsed);
                foreach (var kv in heuristicFields)
                {
                    if (!fields.ContainsKey(kv.Key) && !string.IsNullOrWhiteSpace(kv.Value))
                    {
                        fields[kv.Key] = kv.Value;
                    }
                }

                // Legacy AI key:value backup
                var aiFields = ExtractAiFields(text);
                foreach (var kv in aiFields)
                {
                    if (!fields.ContainsKey(kv.Key) && !string.IsNullOrWhiteSpace(kv.Value))
                    {
                        fields[kv.Key] = kv.Value;
                    }
                }

                var fallbackIssueDate = ExtractFirstDate(text);
                _logger.LogInformation("Fallback date probe for {File}: first date in text = {Date}", file, fallbackIssueDate);
                if ((!fields.TryGetValue("issue_date", out var existingIssue) || string.IsNullOrWhiteSpace(existingIssue)) && fallbackIssueDate is not null)
                {
                    fields["issue_date"] = fallbackIssueDate.Value.ToString("yyyy-MM-dd");
                    _logger.LogInformation("Fallback issue_date extracted as {Date} for {File}", fallbackIssueDate.Value, file);
                }

                var sanitizedFields = SanitizeFields(fields);
                var extractionConfidence = structured?.Confidence is null ? (decimal?)null : (decimal)Math.Clamp(structured.Confidence.Value, 0.0, 1.0);

                // Final guard: if dates were dropped during sanitization but we have a fallback, put them back in
                if (!sanitizedFields.ContainsKey("issue_date") && fallbackIssueDate is not null)
                {
                    sanitizedFields["issue_date"] = fallbackIssueDate.Value.ToString("yyyy-MM-dd");
                }

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
                    DateTime.UtcNow,
                    _options.DocumentType,
                    extractionConfidence);

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

            // Step 1b: PDF text extraction fallback (captures embedded text like "October 8th 2025")
            var pdfText = await TryReadPdfTextAsync(file, token);
            if (!string.IsNullOrWhiteSpace(pdfText))
            {
                if (string.IsNullOrWhiteSpace(rawText))
                {
                    rawText = pdfText;
                }
                else
                {
                    rawText = rawText + Environment.NewLine + pdfText;
                }
                _logger.LogInformation("PDF text fallback preview: {Preview}", Truncate(pdfText, 500));
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

    private static string RemoveDateOrdinals(string value)
    {
        // Regex to find and remove ordinal suffixes (st, nd, rd, th) that are immediately preceded by 1 or 2 digits.
        // It accounts for potential commas after the ordinal suffix (e.g., "8th, 2025")
        return Regex.Replace(value, @"(\d{1,2})(?:st|nd|rd|th)(,?\s*)", "$1$2", RegexOptions.IgnoreCase);
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
                    // Apply ordinal removal to inline date string from Florence-style format
                    dateText = RemoveDateOrdinals(dateText);
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
                // Check if the line parses as a date (e.g. 2024-01-01)
                if (DateTime.TryParse(line, out var dt))
                {
                    fields["issue_date"] = dt.ToString("yyyy-MM-dd");
                    break;
                }

                // Regex to find Month Day[st|nd|rd|th] Year (e.g., October 8th 2025)
                var m = Regex.Match(line, @"(?<month>January|February|March|April|May|June|July|August|September|October|November|December)\s+(?<day>\d{1,2})(?:st|nd|rd|th)?\s+(?<year>\d{4})", RegexOptions.IgnoreCase);
                if (m.Success)
                {
                    // Construct the string without the ordinal suffix for reliable parsing
                    var dateStringWithoutOrdinal = $"{m.Groups["month"].Value} {m.Groups["day"].Value} {m.Groups["year"].Value}";
                    if (DateTime.TryParse(dateStringWithoutOrdinal, out var dt2))
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
                var key = kv.Key.ToLowerInvariant();
                if (key is "issue_date" or "expiry_date")
                {
                    if (!TryNormalizeDate(value, out var normalizedDate))
                    {
                        // Drop non-dates so we don't overwrite good AI dates with noise
                        continue;
                    }

                    value = normalizedDate;
                }

                cleaned[kv.Key] = value!;
            }
        }

        return cleaned;
    }

    private static Dictionary<string, string> ExtractAiFields(string text)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (string.IsNullOrWhiteSpace(text)) return result;

        var lines = text.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
        foreach (var line in lines)
        {
            var idx = line.IndexOf(':');
            if (idx <= 0) continue;
            var key = line[..idx].Trim();
            var value = line[(idx + 1)..].Trim();
            if (string.IsNullOrWhiteSpace(key)) continue;

            // Only take known keys
            if (key.Equals("staff_name", StringComparison.OrdinalIgnoreCase) ||
                key.Equals("course_name", StringComparison.OrdinalIgnoreCase) ||
                key.Equals("issuer", StringComparison.OrdinalIgnoreCase) ||
                key.Equals("issue_date", StringComparison.OrdinalIgnoreCase) ||
                key.Equals("expiry_date", StringComparison.OrdinalIgnoreCase))
            {
                result[key] = value;
            }
        }

        return result;
    }

    private static DateOnly? ExtractFirstDate(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        // Simple date finder that matches common formats
        var patterns = new[]
        {
            @"\b\d{4}-\d{2}-\d{2}\b",
            @"\b\d{2}/\d{2}/\d{4}\b",
            @"\b\d{2}-\d{2}-\d{4}\b",
            // This matches 'October 8th, 2025'
            @"\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b",
            // This matches '8th October 2025'
            @"\b\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December),?\s+\d{4}\b",
            @"\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b",
            @"\b\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+\d{4}\b"
        };

        foreach (var pattern in patterns)
        {
            var match = Regex.Match(text, pattern, RegexOptions.IgnoreCase);
            if (match.Success)
            {
                // Clean the ordinal suffixes (e.g., "8th" -> "8") before parsing
                var cleanedDate = RemoveDateOrdinals(match.Value);

                if (DateTime.TryParse(cleanedDate, out var dt))
                {
                    return DateOnly.FromDateTime(dt);
                }
            }
        }

        return null;
    }

    private static bool TryNormalizeDate(string value, out string normalized)
    {
        normalized = string.Empty;
        // Clean the ordinal suffixes first
        var cleaned = RemoveDateOrdinals(value.Trim().Trim('"', '\'', ',', ';', '.', '’', '”', '“'));

        var formats = new[]
        {
            "yyyy-MM-dd",
            "dd/MM/yyyy",
            "MM/dd/yyyy",
            "dd-MM-yyyy",
            "MM-dd-yyyy",
            "d MMM yyyy",
            "d MMMM yyyy",
            "MMMM d yyyy",
            "d MMM, yyyy",
            "MMMM d, yyyy"
        };

        if (DateTime.TryParseExact(cleaned, formats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var dt) ||
            DateTime.TryParse(cleaned, CultureInfo.InvariantCulture, DateTimeStyles.None, out dt))
        {
            normalized = dt.ToString("yyyy-MM-dd");
            return true;
        }

        return false;
    }

    private static string Truncate(string value, int max)
    {
        if (string.IsNullOrEmpty(value)) return value ?? string.Empty;
        return value.Length <= max ? value : value[..max] + "...";
    }

    private static async Task<string?> TryReadPdfTextAsync(string file, CancellationToken token)
    {
        if (!file.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = "pdftotext",
                ArgumentList = { "-layout", file, "-" },
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false
            };
            using var proc = Process.Start(psi);
            if (proc is null)
            {
                return null;
            }

            var output = await proc.StandardOutput.ReadToEndAsync();
            await proc.WaitForExitAsync(token);
            return string.IsNullOrWhiteSpace(output) ? null : output;
        }
        catch (Exception ex)
        {
            // Non-fatal; just log to debug
            return null;
        }
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
