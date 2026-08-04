namespace CertiWatch.Agent.Options;

public sealed class AgentOptions
{
    public string ApiBaseUrl { get; set; } = "http://localhost:5001";
    public Guid TenantId { get; set; } = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    public Guid SourceId { get; set; } = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");
    public string EnrollmentCode { get; set; } = "DEV-000000";
    public string DeviceName { get; set; } = Environment.MachineName;
    // Empty by default, not "the current user's Documents folder" - .NET's ConfigurationBinder
    // appends config-provided array values onto an already-non-null array/list property instead
    // of replacing it, so a non-empty default here would silently ALSO get watched alongside
    // whatever folder is actually configured (via Agent__WatchPaths__0 or agent.settings.json).
    // The one-line installer always requires an explicit path now; an empty result here means
    // nothing was configured at all, which AgentWorker logs as a warning rather than guessing.
    public IReadOnlyList<string> WatchPaths { get; set; } = Array.Empty<string>();
    public string ProcessedFilesPath { get; set; } = Path.Combine(AppContext.BaseDirectory, "processed-files.json");
    public string CredentialsPath { get; set; } = Path.Combine(AppContext.BaseDirectory, "device-credentials.json");
    public long MaxUploadSizeBytes { get; set; } = 20 * 1024 * 1024;
    public IReadOnlyList<string> AllowedExtensions { get; set; } = new[] { ".pdf", ".png", ".jpg", ".jpeg" };
}
