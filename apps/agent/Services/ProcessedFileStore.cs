using System.Text.Json;

namespace CertiWatch.Agent.Services;

public interface IProcessedFileStore
{
    Task<bool> HasProcessedAsync(string fileHash, CancellationToken token);
    Task MarkProcessedAsync(string fileHash, CancellationToken token);
}

// Persists which file hashes have already been uploaded, across agent restarts - without this,
// the agent would re-upload every file in every watched folder on every restart, since an
// in-memory-only "seen" set resets to empty each time the process starts.
public sealed class ProcessedFileStore : IProcessedFileStore
{
    private readonly string _storePath;
    private readonly SemaphoreSlim _lock = new(1, 1);

    public ProcessedFileStore(string storePath)
    {
        _storePath = storePath;
        var dir = Path.GetDirectoryName(storePath);
        if (!string.IsNullOrWhiteSpace(dir) && !Directory.Exists(dir))
        {
            Directory.CreateDirectory(dir);
        }
    }

    public async Task<bool> HasProcessedAsync(string fileHash, CancellationToken token)
    {
        await _lock.WaitAsync(token);
        try
        {
            var entries = await ReadAsync();
            return entries.ContainsKey(fileHash);
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task MarkProcessedAsync(string fileHash, CancellationToken token)
    {
        await _lock.WaitAsync(token);
        try
        {
            var entries = await ReadAsync();
            entries[fileHash] = DateTime.UtcNow;
            await WriteAsync(entries);
        }
        finally
        {
            _lock.Release();
        }
    }

    private async Task<Dictionary<string, DateTime>> ReadAsync()
    {
        if (!File.Exists(_storePath))
        {
            return new Dictionary<string, DateTime>();
        }

        await using var stream = File.OpenRead(_storePath);
        return await JsonSerializer.DeserializeAsync<Dictionary<string, DateTime>>(stream)
            ?? new Dictionary<string, DateTime>();
    }

    private async Task WriteAsync(Dictionary<string, DateTime> entries)
    {
        await using var stream = File.Create(_storePath);
        await JsonSerializer.SerializeAsync(stream, entries, new JsonSerializerOptions { WriteIndented = true });
    }
}
