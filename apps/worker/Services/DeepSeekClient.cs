using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using CertiWatch.Worker.Options;
using Microsoft.Extensions.Options;

namespace CertiWatch.Worker.Services;

public interface IDeepSeekClient
{
    Task<string> ExtractTextAsync(string rawText, CancellationToken cancellationToken);
    Task<StructuredExtractionResult?> ExtractStructuredAsync(string rawText, string? documentType, CancellationToken cancellationToken);
}

/// <summary>
/// Uses DeepSeek chat completions to turn noisy OCR text into structured key:value lines.
/// </summary>
public sealed class DeepSeekClient : IDeepSeekClient
{
    private readonly HttpClient _httpClient;
    private readonly WorkerOptions _options;
    private readonly ILogger<DeepSeekClient> _logger;
    private readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web);

    public DeepSeekClient(HttpClient httpClient, IOptions<WorkerOptions> options, ILogger<DeepSeekClient> logger)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<string> ExtractTextAsync(string rawText, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(rawText))
        {
            return string.Empty;
        }

        if (string.IsNullOrWhiteSpace(_options.DeepSeekApiKey))
        {
            throw new InvalidOperationException("DeepSeek not configured.");
        }

        var endpoint = $"{_options.DeepSeekBaseUrl.TrimEnd('/')}/v1/chat/completions";
        using var req = new HttpRequestMessage(HttpMethod.Post, endpoint);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.DeepSeekApiKey);

        var systemPrompt = """
You are an information extraction engine for training certificates. Given raw OCR text, output ONLY JSON with these fields:
{
  "staff_name": string,
  "course_name": string,
  "issuer": string,
  "issue_date": string (YYYY-MM-DD if possible),
  "expiry_date": string or null (YYYY-MM-DD if possible),
  "candidate_code": string or null,
  "verification_url": string or null
}
If a value is unknown, set it to null. Do not include any extra text or markdown.
""";

        var payload = new
        {
            model = "deepseek-chat",
            temperature = 0.1,
            messages = new object[]
            {
                new { role = "system", content = systemPrompt },
                new { role = "user", content = rawText }
            }
        };

        var json = JsonSerializer.Serialize(payload, _jsonOptions);
        req.Content = new StringContent(json, Encoding.UTF8, "application/json");

        var resp = await _httpClient.SendAsync(req, cancellationToken);
        var body = await resp.Content.ReadAsStringAsync(cancellationToken);

        if (!resp.IsSuccessStatusCode)
        {
            _logger.LogWarning("DeepSeek extract failed {Status}: {Body}", resp.StatusCode, body);
            throw new InvalidOperationException($"DeepSeek extract failed: {resp.StatusCode}");
        }

        try
        {
            using var doc = JsonDocument.Parse(body);
            var content = doc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString();

            if (string.IsNullOrWhiteSpace(content))
            {
                return string.Empty;
            }

            // Try to parse JSON; if success, flatten to key:value lines so downstream parser sees clean fields.
            try
            {
                using var parsed = JsonDocument.Parse(content);
                var lines = new List<string>();
                foreach (var prop in parsed.RootElement.EnumerateObject())
                {
                    lines.Add($"{prop.Name}: {prop.Value.ToString()}");
                }

                _logger.LogInformation("DeepSeek parsed fields: {Fields}", string.Join(", ", lines));
                return string.Join(Environment.NewLine, lines);
            }
            catch
            {
                // If not valid JSON, just return the content as-is.
                var trimmed = content.Trim();
                _logger.LogInformation("DeepSeek raw content: {Preview}", Truncate(trimmed, 500));
                return trimmed;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to parse DeepSeek response");
            return string.Empty;
        }
    }

    private static string Truncate(string value, int max)
    {
        if (string.IsNullOrEmpty(value)) return value ?? string.Empty;
        return value.Length <= max ? value : value[..max] + "...";
    }

    public async Task<StructuredExtractionResult?> ExtractStructuredAsync(string rawText, string? documentType, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(rawText))
        {
            return null;
        }

        if (string.IsNullOrWhiteSpace(_options.DeepSeekApiKey))
        {
            throw new InvalidOperationException("DeepSeek not configured.");
        }

        var endpoint = $"{_options.DeepSeekBaseUrl.TrimEnd('/')}/v1/chat/completions";
        using var req = new HttpRequestMessage(HttpMethod.Post, endpoint);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.DeepSeekApiKey);

        var systemPrompt = """
You are a structured extractor for training certificates. Return ONLY JSON matching this schema:
{
  "staff_name": string | null,
  "course_name": string | null,
  "issuer": string | null,
  "issue_date": string | null,   // format YYYY-MM-DD
  "expiry_date": string | null,  // format YYYY-MM-DD
  "confidence": number           // 0.0 - 1.0
}
If a value is unknown, set it to null. Do not include any extra fields or text.
""";

        var userPrompt = $"Document type: {documentType ?? "generic_certificate"}\nExtract fields from this text:\n{rawText}";

        var payload = new
        {
            model = "deepseek-chat",
            temperature = 0.1,
            messages = new object[]
            {
                new { role = "system", content = systemPrompt },
                new { role = "user", content = userPrompt }
            }
        };

        var json = JsonSerializer.Serialize(payload, _jsonOptions);
        req.Content = new StringContent(json, Encoding.UTF8, "application/json");

        var resp = await _httpClient.SendAsync(req, cancellationToken);
        var body = await resp.Content.ReadAsStringAsync(cancellationToken);

        if (!resp.IsSuccessStatusCode)
        {
            _logger.LogWarning("DeepSeek structured extract failed {Status}: {Body}", resp.StatusCode, body);
            return null;
        }

        try
        {
            using var doc = JsonDocument.Parse(body);
            var content = doc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString();

            if (string.IsNullOrWhiteSpace(content))
            {
                return null;
            }

            StructuredExtractionResult? result = null;
            try
            {
                result = JsonSerializer.Deserialize<StructuredExtractionResult>(content, _jsonOptions);
            }
            catch
            {
                // fall back to key:value parsing
                var lines = content.Split('\n', StringSplitOptions.RemoveEmptyEntries);
                var dict = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
                foreach (var line in lines)
                {
                    var idx = line.IndexOf(':');
                    if (idx <= 0) continue;
                    var key = line[..idx].Trim();
                    var val = line[(idx + 1)..].Trim();
                    dict[key] = string.IsNullOrWhiteSpace(val) ? null : val;
                }

                result = new StructuredExtractionResult
                {
                    StaffName = dict.GetValueOrDefault("staff_name"),
                    CourseName = dict.GetValueOrDefault("course_name"),
                    Issuer = dict.GetValueOrDefault("issuer"),
                    IssueDate = dict.GetValueOrDefault("issue_date"),
                    ExpiryDate = dict.GetValueOrDefault("expiry_date"),
                    Confidence = double.TryParse(dict.GetValueOrDefault("confidence"), out var c) ? c : null
                };
            }

            _logger.LogInformation("DeepSeek structured parsed fields: staff={Staff} course={Course} issuer={Issuer} issue={Issue} expiry={Expiry} conf={Conf}",
                result?.StaffName, result?.CourseName, result?.Issuer, result?.IssueDate, result?.ExpiryDate, result?.Confidence);

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to parse DeepSeek structured response");
            return null;
        }
    }
}

public sealed class StructuredExtractionResult
{
    [JsonPropertyName("staff_name")]
    public string? StaffName { get; init; }
    [JsonPropertyName("course_name")]
    public string? CourseName { get; init; }
    [JsonPropertyName("issuer")]
    public string? Issuer { get; init; }
    [JsonPropertyName("issue_date")]
    public string? IssueDate { get; init; }
    [JsonPropertyName("expiry_date")]
    public string? ExpiryDate { get; init; }
    [JsonPropertyName("confidence")]
    public double? Confidence { get; init; }
}
