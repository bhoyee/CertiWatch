namespace CertiWatch.Worker.Services;

public interface ITesseractClient
{
    Task<string> ExtractTextAsync(string filePath, CancellationToken cancellationToken);
}

public sealed class TesseractClient(ILogger<TesseractClient> logger) : ITesseractClient
{
    public async Task<string> ExtractTextAsync(string filePath, CancellationToken cancellationToken)
    {
        logger.LogDebug("Reading file {File} using built-in parser", filePath);
        return await File.ReadAllTextAsync(filePath, cancellationToken);
    }
}
