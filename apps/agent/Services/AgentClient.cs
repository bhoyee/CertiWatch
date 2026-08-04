using System.Net.Http.Headers;
using System.Net.Http.Json;
using CertiWatch.Agent.Options;
using CertiWatch.Contracts.Requests;
using CertiWatch.Contracts.Responses;
using Microsoft.Extensions.Options;

namespace CertiWatch.Agent.Services;

public sealed record FileHashCheckResponse(bool Exists, bool ShouldReprocess);

public interface IAgentClient
{
    Task<DeviceEnrollmentResponse?> EnrollAsync(CancellationToken token);
    Task<FileHashCheckResponse?> CheckHashAsync(Guid deviceId, string deviceToken, string fileHash, CancellationToken token);
    Task<bool> UploadAsync(Guid deviceId, string deviceToken, Guid sourceId, string filePath, CancellationToken token);
    Task<bool> HeartbeatAsync(Guid deviceId, string deviceToken, CancellationToken token);
}

/// <summary>
/// Represents a sealed client for interacting with the Agent API.
/// Implements the IAgentClient interface to provide device enrollment,
/// file hash checking, file uploading, and heartbeat functionality.
/// </summary>
public sealed class AgentClient(HttpClient httpClient, IOptions<AgentOptions> options, ILogger<AgentClient> logger) : IAgentClient
{
    private readonly AgentOptions _options = options.Value;

    /// <summary>
    /// Enrolls the device with the Agent API.
    /// </summary>
    /// <param name="token">Cancellation token to cancel the operation.</param>
    /// <returns>A DeviceEnrollmentResponse if successful, otherwise null.</returns>
    public async Task<DeviceEnrollmentResponse?> EnrollAsync(CancellationToken token)
    {
        try
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
        catch (Exception ex)
        {
            // Unlike the other calls here, this one used to be unguarded - a network hiccup during
            // enrollment (DNS, firewall, API not reachable yet) would throw out of ExecuteAsync
            // unhandled, which stops the entire BackgroundService host - on a Windows Service that
            // shows up as the service going straight to "Stopped" with no obvious cause.
            logger.LogError(ex, "Enrollment request failed");
            return null;
        }
    }

    public async Task<FileHashCheckResponse?> CheckHashAsync(Guid deviceId, string deviceToken, string fileHash, CancellationToken token)
    {
        try
        {
            var response = await httpClient.PostAsJsonAsync($"{_options.ApiBaseUrl}/api/devices/check-hash",
                new { DeviceId = deviceId, DeviceToken = deviceToken, FileHash = fileHash }, token);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Hash check failed with status {Status}", response.StatusCode);
                return null;
            }

            return await response.Content.ReadFromJsonAsync<FileHashCheckResponse>(cancellationToken: token);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to check file hash existence");
            return null;
        }
    }

    public async Task<bool> UploadAsync(Guid deviceId, string deviceToken, Guid sourceId, string filePath, CancellationToken token)
    {
        try
        {
            using var content = new MultipartFormDataContent
            {
                { new StringContent(deviceId.ToString()), "deviceId" },
                { new StringContent(deviceToken), "deviceToken" },
                { new StringContent(sourceId.ToString()), "sourceId" }
            };

            await using var fileStream = File.OpenRead(filePath);
            var fileContent = new StreamContent(fileStream);
            fileContent.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
            content.Add(fileContent, "file", Path.GetFileName(filePath));

            var response = await httpClient.PostAsync($"{_options.ApiBaseUrl}/api/devices/upload", content, token);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Upload of {File} failed with status {Status}", filePath, response.StatusCode);
                return false;
            }

            return true;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to upload {File}", filePath);
            return false;
        }
    }

    public async Task<bool> HeartbeatAsync(Guid deviceId, string deviceToken, CancellationToken token)
    {
        try
        {
            var response = await httpClient.PostAsJsonAsync($"{_options.ApiBaseUrl}/api/devices/heartbeat", new DeviceHeartbeatRequest
            {
                DeviceId = deviceId,
                DeviceToken = deviceToken,
                Version = "1.0",
                WatchPaths = _options.WatchPaths
            }, token);

            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Heartbeat failed");
            return false;
        }
    }
}
