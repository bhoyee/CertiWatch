namespace CertiWatch.Worker.Options;

public sealed class WorkerOptions
{
    public string ApiBaseUrl { get; set; } = "https://localhost:5001";
    public Guid TenantId { get; set; } = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    public Guid SourceId { get; set; } = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");
    public string DeviceToken { get; set; } = "dev-token";
    public string AzureVisionEndpoint { get; set; } = string.Empty;
    public string AzureVisionKey { get; set; } = string.Empty;
    public IReadOnlyList<string> WatchPaths { get; set; } = new[] { "samples/documents" };
}
