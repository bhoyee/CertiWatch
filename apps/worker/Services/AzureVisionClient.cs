using CertiWatch.Worker.Options;
using Microsoft.Extensions.Options;

namespace CertiWatch.Worker.Services;

public interface IAzureVisionClient
{
    Task<string> ExtractTextAsync(string filePath, CancellationToken cancellationToken);
}

public sealed class AzureVisionClient(IOptions<WorkerOptions> options, ILogger<AzureVisionClient> logger) : IAzureVisionClient
{
    private readonly WorkerOptions _options = options.Value;

    public async Task<string> ExtractTextAsync(string filePath, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(_options.AzureVisionEndpoint) || string.IsNullOrWhiteSpace(_options.AzureVisionKey))
        {
            logger.LogDebug("Azure Vision disabled. Falling back to local text read");
            return await File.ReadAllTextAsync(filePath, cancellationToken);
        }

        // Placeholder for actual API call. For now we read the text content.
        logger.LogInformation("Pretending to call Azure Vision for {File}", filePath);
        return await File.ReadAllTextAsync(filePath, cancellationToken);
    }
}
