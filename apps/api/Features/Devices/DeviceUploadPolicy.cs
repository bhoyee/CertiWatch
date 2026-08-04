namespace CertiWatch.Api.Features.Devices;

// Server-side upload validation rules, kept separate from the endpoint handler so they can be
// unit tested without spinning up the full request pipeline. The agent applies the same rules
// client-side before uploading, but the server never trusts that - this is the check that matters.
public static class DeviceUploadPolicy
{
    public const long MaxUploadSizeBytes = 20 * 1024 * 1024;

    public static readonly string[] AllowedExtensions = { ".pdf", ".png", ".jpg", ".jpeg" };

    public static bool IsAllowedExtension(string fileName)
    {
        var extension = Path.GetExtension(fileName);
        return AllowedExtensions.Contains(extension, StringComparer.OrdinalIgnoreCase);
    }

    public static bool ExceedsMaxSize(long fileSizeBytes) => fileSizeBytes > MaxUploadSizeBytes;
}
