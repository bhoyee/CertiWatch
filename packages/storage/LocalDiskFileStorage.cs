using Microsoft.Extensions.Options;

namespace CertiWatch.Storage;

// Local dev / single-box fallback. Also transparently serves pre-migration rows that still hold
// an old absolute path (e.g. "/uploads/{tenantId}/...") instead of a root-relative key: Path.Combine
// returns an absolute second argument unchanged on Linux, so those old values resolve correctly
// here without any special-casing - only the R2 provider actually needs the migration to have run.
public sealed class LocalDiskFileStorage(IOptions<StorageOptions> options) : IFileStorage
{
    private readonly string _root = options.Value.UploadsRoot;

    private string ResolvePath(string key) => Path.Combine(_root, key.Replace('/', Path.DirectorySeparatorChar));

    public async Task SaveAsync(string key, Stream content, string? contentType, CancellationToken token)
    {
        var path = ResolvePath(key);
        var dir = Path.GetDirectoryName(path);
        if (!string.IsNullOrEmpty(dir))
        {
            Directory.CreateDirectory(dir);
        }

        await using var file = File.Create(path);
        await content.CopyToAsync(file, token);
    }

    public Task<Stream> OpenReadAsync(string key, CancellationToken token) =>
        Task.FromResult<Stream>(File.OpenRead(ResolvePath(key)));

    public Task<bool> ExistsAsync(string key, CancellationToken token) =>
        Task.FromResult(File.Exists(ResolvePath(key)));

    public Task DeleteAsync(string key, CancellationToken token)
    {
        var path = ResolvePath(key);
        if (File.Exists(path))
        {
            File.Delete(path);
        }

        return Task.CompletedTask;
    }
}
