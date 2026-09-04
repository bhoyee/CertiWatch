using System.Net.Http.Headers;
using System.Text.Json;
using CertiWatch.Worker.Options;
using Microsoft.Extensions.Options;

namespace CertiWatch.Worker.Services;

public interface IOcrSpaceClient
{
    Task<string> ExtractTextAsync(string filePath, CancellationToken cancellationToken);
}

// https://ocr.space/ocrapi - a hosted OCR fallback for when Doctr isn't configured. Free tier
// needs only a key from that page (no paid signup, unlike Azure Vision), but caps file size at
// roughly 1MB and rate-limits requests, so this is meant to stand in as a backup engine, not
// replace Doctr as the primary one.
public sealed class OcrSpaceClient : IOcrSpaceClient
{
    private const string Endpoint = "https://api.ocr.space/parse/image";
    private const long FreeTierMaxFileBytes = 1_000_000;

    private readonly HttpClient _httpClient;
    private readonly WorkerOptions _options;
    private readonly ILogger<OcrSpaceClient> _logger;

    public OcrSpaceClient(HttpClient httpClient, IOptions<WorkerOptions> options, ILogger<OcrSpaceClient> logger)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<string> ExtractTextAsync(string filePath, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(_options.OcrSpaceApiKey))
        {
            throw new InvalidOperationException("OcrSpaceApiKey is not configured.");
        }

        var fileInfo = new FileInfo(filePath);
        if (fileInfo.Length > FreeTierMaxFileBytes)
        {
            throw new InvalidOperationException(
                $"File is {fileInfo.Length} bytes, over OCR.space's free-tier limit (~{FreeTierMaxFileBytes} bytes).");
        }

        using var form = new MultipartFormDataContent
        {
            { new StringContent(_options.OcrSpaceApiKey), "apikey" },
            { new StringContent("eng"), "language" },
            { new StringContent("false"), "isOverlayRequired" },
            { new StringContent("true"), "scale" },
            { new StringContent("2"), "OCREngine" }
        };

        await using var stream = File.OpenRead(filePath);
        var fileContent = new StreamContent(stream);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        form.Add(fileContent, "file", Path.GetFileName(filePath));

        var response = await _httpClient.PostAsync(Endpoint, form, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("OCR.space request failed with {Status}: {Body}", response.StatusCode, body);
            throw new InvalidOperationException($"OCR.space request failed: {response.StatusCode}");
        }

        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;

        if (root.TryGetProperty("IsErroredOnProcessing", out var errored) && errored.ValueKind == JsonValueKind.True)
        {
            var message = root.TryGetProperty("ErrorMessage", out var msg) ? DescribeError(msg) : "unknown error";
            throw new InvalidOperationException($"OCR.space reported a processing error: {message}");
        }

        if (!root.TryGetProperty("ParsedResults", out var results) || results.ValueKind != JsonValueKind.Array)
        {
            _logger.LogWarning("OCR.space response missing ParsedResults");
            return string.Empty;
        }

        var texts = results.EnumerateArray()
            .Select(r => r.TryGetProperty("ParsedText", out var t) ? t.GetString() ?? string.Empty : string.Empty);
        return string.Join(Environment.NewLine, texts);
    }

    // ErrorMessage comes back as either a single string or an array of strings depending on
    // which error path OCR.space hits - handle both rather than assume one shape.
    private static string DescribeError(JsonElement errorMessageElement)
        => errorMessageElement.ValueKind == JsonValueKind.Array
            ? string.Join("; ", errorMessageElement.EnumerateArray().Select(e => e.GetString()))
            : errorMessageElement.GetString() ?? "unknown error";
}
