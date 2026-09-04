namespace CertiWatch.Worker.Options;

using System.IO;

public sealed class WorkerOptions
{
    public string ApiBaseUrl { get; set; } = "http://localhost:5001";
    public Guid TenantId { get; set; } = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    public Guid SourceId { get; set; } = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");
    public Guid DeviceId { get; set; } = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    public string DeviceToken { get; set; } = "dev-token";
    public string OcrSpaceApiKey { get; set; } = string.Empty;
    public string DoctrBaseUrl { get; set; } = string.Empty;
    public string DeepSeekApiKey { get; set; } = string.Empty;
    public string DeepSeekBaseUrl { get; set; } = "https://api.deepseek.com";
    public IReadOnlyList<string> WatchPaths { get; set; } = new[] { UploadsPath, DefaultCloudImportPath };
    public bool EnableWatcher { get; set; } = true;
    public bool EnableSampleDocuments { get; set; } = false;
    public string DocumentType { get; set; } = "generic_certificate";
    public int CloudImportPollMinutes { get; set; } = 5;
    public string CloudImportDownloadPath { get; set; } = DefaultCloudImportPath;

    private static string DefaultSamplesPath =>
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "samples", "documents"));

    private static string UploadsPath =>
        "/uploads";

    private static string DefaultCloudImportPath =>
        "/tmp/cloud-import";
}
