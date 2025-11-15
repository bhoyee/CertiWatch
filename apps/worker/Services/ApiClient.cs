using System.Net.Http.Json;
using CertiWatch.Contracts.Events;
using CertiWatch.Contracts.Enums;
using CertiWatch.Worker.Options;
using Microsoft.Extensions.Options;

namespace CertiWatch.Worker.Services;

public interface IApiClient
{
    Task PublishDocumentAsync(DocumentDetectedEvent payload, CancellationToken cancellationToken);
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
                deviceId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
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
}
