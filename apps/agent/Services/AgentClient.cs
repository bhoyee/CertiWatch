using System.Net.Http.Json;
using CertiWatch.Agent.Options;
using CertiWatch.Contracts.Events;
using CertiWatch.Contracts.Requests;
using CertiWatch.Contracts.Responses;
using Microsoft.Extensions.Options;

namespace CertiWatch.Agent.Services;

public interface IAgentClient
{
    Task<DeviceEnrollmentResponse?> EnrollAsync(CancellationToken token);
    Task<bool> PushAsync(DeviceEventRequest request, CancellationToken token);
}

public sealed class AgentClient(HttpClient httpClient, IOptions<AgentOptions> options, ILogger<AgentClient> logger) : IAgentClient
{
    private readonly AgentOptions _options = options.Value;

    public async Task<DeviceEnrollmentResponse?> EnrollAsync(CancellationToken token)
    {
        var response = await httpClient.PostAsJsonAsync($"{_options.ApiBaseUrl}/api/devices/enroll", new EnrollDeviceRequest
        {
            DeviceName = _options.DeviceName,
            OperatingSystem = Environment.OSVersion.Platform.ToString(),
            EnrollmentCode = _options.EnrollmentCode
        }, token);

        if (!response.IsSuccessStatusCode)
        {
            logger.LogWarning("Enrollment failed with status {Status}", response.StatusCode);
            return null;
        }

        return await response.Content.ReadFromJsonAsync<DeviceEnrollmentResponse>(cancellationToken: token);
    }

    public async Task<bool> PushAsync(DeviceEventRequest request, CancellationToken token)
    {
        var response = await httpClient.PostAsJsonAsync($"{_options.ApiBaseUrl}/api/devices/events", request, token);
        if (!response.IsSuccessStatusCode)
        {
            logger.LogWarning("Failed to push {Count} documents", request.Documents.Count);
            return false;
        }

        return true;
    }
}
