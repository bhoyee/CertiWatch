namespace CertiWatch.Storage;

public sealed class StorageOptions
{
    /// <summary>"Disk" (default, local dev) or "R2" (Cloudflare R2, S3-compatible).</summary>
    public string Provider { get; set; } = "Disk";

    /// <summary>Root folder for the Disk provider. Defaults to /uploads when not provided.</summary>
    public string UploadsRoot { get; set; } = "/uploads";

    public R2Options R2 { get; set; } = new();
}

public sealed class R2Options
{
    public string AccountId { get; set; } = string.Empty;
    public string AccessKeyId { get; set; } = string.Empty;
    public string SecretAccessKey { get; set; } = string.Empty;
    public string BucketName { get; set; } = string.Empty;
}
