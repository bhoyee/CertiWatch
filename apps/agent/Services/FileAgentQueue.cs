using System.Text.Json;
using CertiWatch.Contracts.Events;

namespace CertiWatch.Agent.Services;

public interface IAgentQueue
{
    Task EnqueueAsync(DocumentDetectedEvent payload, CancellationToken token);
    Task<IReadOnlyList<DocumentDetectedEvent>> FlushAsync(CancellationToken token);
}

public sealed class FileAgentQueue : IAgentQueue
{
    private readonly string _queuePath;
    private readonly SemaphoreSlim _lock = new(1, 1);

    public FileAgentQueue(string queuePath)
    {
        _queuePath = queuePath;
        var dir = Path.GetDirectoryName(queuePath);
        if (!string.IsNullOrWhiteSpace(dir) && !Directory.Exists(dir))
        {
            Directory.CreateDirectory(dir);
        }
    }

    public async Task EnqueueAsync(DocumentDetectedEvent payload, CancellationToken token)
    {
        await _lock.WaitAsync(token);
        try
        {
            var items = (await ReadAsync())?.ToList() ?? new List<DocumentDetectedEvent>();
            items.Add(payload);
            await WriteAsync(items);
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task<IReadOnlyList<DocumentDetectedEvent>> FlushAsync(CancellationToken token)
    {
        await _lock.WaitAsync(token);
        try
        {
            var items = (await ReadAsync())?.ToList() ?? new List<DocumentDetectedEvent>();
            await WriteAsync(Array.Empty<DocumentDetectedEvent>());
            return items;
        }
        finally
        {
            _lock.Release();
        }
    }

    private async Task<IEnumerable<DocumentDetectedEvent>?> ReadAsync()
    {
        if (!File.Exists(_queuePath))
        {
            return Array.Empty<DocumentDetectedEvent>();
        }

        await using var stream = File.OpenRead(_queuePath);
        return await JsonSerializer.DeserializeAsync<List<DocumentDetectedEvent>>(stream) ?? new List<DocumentDetectedEvent>();
    }

    private async Task WriteAsync(IEnumerable<DocumentDetectedEvent> items)
    {
        await using var stream = File.Create(_queuePath);
        await JsonSerializer.SerializeAsync(stream, items, new JsonSerializerOptions { WriteIndented = true });
    }
}
