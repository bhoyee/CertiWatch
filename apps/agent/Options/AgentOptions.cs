namespace CertiWatch.Agent.Options;

public sealed class AgentOptions
{
    public string ApiBaseUrl { get; set; } = "http://localhost:5001";
    public Guid TenantId { get; set; } = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    public Guid SourceId { get; set; } = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");
    public string EnrollmentCode { get; set; } = "DEV-000000";
    public string DeviceName { get; set; } = Environment.MachineName;
    public IReadOnlyList<string> WatchPaths { get; set; } = new[] { Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments) };
    public string ProcessedFilesPath { get; set; } = Path.Combine(AppContext.BaseDirectory, "processed-files.json");
    public long MaxUploadSizeBytes { get; set; } = 20 * 1024 * 1024;
    public IReadOnlyList<string> AllowedExtensions { get; set; } = new[] { ".pdf", ".png", ".jpg", ".jpeg" };
}
