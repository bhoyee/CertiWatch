using System.Net.Http.Headers;
using System.Text.Json;
using CertiWatch.Worker.Options;
using Microsoft.Extensions.Options;

namespace CertiWatch.Worker.Services;

public interface IDoctrClient
{
    Task<string> ExtractTextAsync(string filePath, CancellationToken cancellationToken);
}

public sealed class DoctrClient : IDoctrClient
{
    private readonly HttpClient _httpClient;
    private readonly WorkerOptions _options;
    private readonly ILogger<DoctrClient> _logger;

    public DoctrClient(HttpClient httpClient, IOptions<WorkerOptions> options, ILogger<DoctrClient> logger)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<string> ExtractTextAsync(string filePath, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(_options.DoctrBaseUrl))
        {
            throw new InvalidOperationException("DoctrBaseUrl is not configured.");
        }

        using var form = new MultipartFormDataContent();
        await using var stream = File.OpenRead(filePath);
        var fileContent = new StreamContent(stream);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        form.Add(fileContent, "file", Path.GetFileName(filePath));

        var url = $"{_options.DoctrBaseUrl.TrimEnd('/')}/ocr";
        var response = await _httpClient.PostAsync(url, form, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogWarning("Doctr OCR failed with {Status}: {Body}", response.StatusCode, body);
            throw new InvalidOperationException($"Doctr OCR failed: {response.StatusCode}");
        }

        var json = await response.Content.ReadAsStringAsync(cancellationToken);
        var doc = JsonDocument.Parse(json);
        if (doc.RootElement.TryGetProperty("lines", out var linesElem) && linesElem.ValueKind == JsonValueKind.Array)
        {
            var lines = linesElem.EnumerateArray().Select(e => e.GetString() ?? string.Empty);
            return string.Join(Environment.NewLine, lines);
        }

        _logger.LogWarning("Doctr OCR response missing 'lines' array");
        return string.Empty;
    }
}
