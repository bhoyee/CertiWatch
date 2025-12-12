using System.Net.Http.Json;
using CertiWatch.Contracts.Events;
using CertiWatch.Contracts.Enums;
using CertiWatch.Worker.Options;
using Microsoft.Extensions.Options;

namespace CertiWatch.Worker.Services;

public interface IApiClient
{
    Task PublishDocumentAsync(DocumentDetectedEvent payload, CancellationToken cancellationToken);
    Task<FileHashCheckResponse?> GetFileHashStatusAsync(Guid deviceId, string fileHash, CancellationToken cancellationToken);
}

public sealed class ApiClient(HttpClient httpClient, IOptions<WorkerOptions> options, ILogger<ApiClient> logger) : IApiClient
{
    private readonly WorkerOptions _options = options.Value;

    public async Task PublishDocumentAsync(DocumentDetectedEvent payload, CancellationToken cancellationToken)
    {
        try
        {
            var response = await httpClient.PostAsJsonAsync($"{_options.ApiBaseUrl}/api/devices/events", new
            {
                deviceId = _options.DeviceId,
                documents = new[] { payload }
            }, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("API rejected document payload with status {Status}", response.StatusCode);
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to push document payload");
        }
    }

    public async Task<FileHashCheckResponse?> GetFileHashStatusAsync(Guid deviceId, string fileHash, CancellationToken cancellationToken)
    {
        try
        {
            var response = await httpClient.PostAsJsonAsync($"{_options.ApiBaseUrl}/api/devices/check-hash",
                new { DeviceId = deviceId, FileHash = fileHash }, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Hash check failed with status {Status}", response.StatusCode);
                return null;
            }

            var result = await response.Content.ReadFromJsonAsync<FileHashCheckResponse>(cancellationToken: cancellationToken);
            return result;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to check file hash existence");
            return null;
        }
    }
}

public sealed record FileHashCheckResponse(bool Exists, bool ShouldReprocess);
