using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using CertiWatch.Worker.Options;
using Microsoft.Extensions.Options;

namespace CertiWatch.Worker.Services;

public interface IDeepSeekClient
{
    Task<string> ExtractTextAsync(string rawText, CancellationToken cancellationToken);
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
}
