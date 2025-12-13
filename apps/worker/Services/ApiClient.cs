using System.Net.Http.Json;
using CertiWatch.Contracts.Events;
using CertiWatch.Contracts.Enums;
using CertiWatch.Contracts.Dtos;
using CertiWatch.Worker.Options;
using Microsoft.Extensions.Options;

namespace CertiWatch.Worker.Services;

public interface IApiClient
{
    Task PublishDocumentAsync(DocumentDetectedEvent payload, CancellationToken cancellationToken);
    Task<FileHashCheckResponse?> GetFileHashStatusAsync(Guid deviceId, string fileHash, CancellationToken cancellationToken);
    Task<IReadOnlyList<SourceDto>> GetSourcesAsync(Guid deviceId, string deviceToken, CancellationToken cancellationToken);
    Task ReportSourceSyncAsync(Guid deviceId, string deviceToken, Guid sourceId, string status, string? message, CancellationToken cancellationToken);
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

    public async Task<IReadOnlyList<SourceDto>> GetSourcesAsync(Guid deviceId, string deviceToken, CancellationToken cancellationToken)
    {
        try
        {
            var response = await httpClient.GetAsync($"{_options.ApiBaseUrl}/api/devices/{deviceId}/sources?deviceToken={Uri.EscapeDataString(deviceToken)}", cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Failed to fetch sources for device {Device} with status {Status}", deviceId, response.StatusCode);
                return Array.Empty<SourceDto>();
            }

            var result = await response.Content.ReadFromJsonAsync<List<SourceDto>>(cancellationToken: cancellationToken);
            return result ?? new List<SourceDto>();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to fetch sources for device {Device}", deviceId);
            return Array.Empty<SourceDto>();
        }
    }

    public async Task ReportSourceSyncAsync(Guid deviceId, string deviceToken, Guid sourceId, string status, string? message, CancellationToken cancellationToken)
    {
        try
        {
            var response = await httpClient.PostAsJsonAsync(
                $"{_options.ApiBaseUrl}/api/devices/{deviceId}/sources/{sourceId}/sync-status?deviceToken={Uri.EscapeDataString(deviceToken)}",
                new { Status = status, Message = message },
                cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Failed to report sync status for source {Source} with status {Code}", sourceId, response.StatusCode);
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to report sync status for source {Source}", sourceId);
        }
    }
}

public sealed record FileHashCheckResponse(bool Exists, bool ShouldReprocess);
