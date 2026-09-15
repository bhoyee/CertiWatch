namespace CertiWatch.Storage;

// A key is a root-relative path with forward slashes, e.g. "{tenantId}/{uploadRequestId}/cert.pdf"
// - never an absolute filesystem path and never prefixed with the Disk provider's UploadsRoot.
// Both providers resolve the same key consistently, which is what makes swapping Disk for R2 (or
// migrating existing rows from one to the other) just a matter of changing where the bytes for a
// given key live, not what the key itself looks like.
public interface IFileStorage
{
    Task SaveAsync(string key, Stream content, string? contentType, CancellationToken token);
    Task<Stream> OpenReadAsync(string key, CancellationToken token);
    Task<bool> ExistsAsync(string key, CancellationToken token);
    Task DeleteAsync(string key, CancellationToken token);
}
