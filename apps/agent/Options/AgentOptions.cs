namespace CertiWatch.Agent.Options;

public sealed class AgentOptions
{
    public string ApiBaseUrl { get; set; } = "https://localhost:5001";
    public Guid TenantId { get; set; } = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    public Guid SourceId { get; set; } = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");
    public string EnrollmentCode { get; set; } = "DEV-000000";
    public string DeviceName { get; set; } = Environment.MachineName;
    public IReadOnlyList<string> WatchPaths { get; set; } = new[] { Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments) };
    public string QueuePath { get; set; } = Path.Combine(AppContext.BaseDirectory, "queue.json");
}
