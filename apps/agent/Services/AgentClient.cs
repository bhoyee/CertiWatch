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
                Version = "1.0"
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
