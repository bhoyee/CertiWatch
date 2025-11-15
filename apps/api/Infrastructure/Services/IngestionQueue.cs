using System.Threading.Channels;
using CertiWatch.Contracts.Events;

namespace CertiWatch.Api.Infrastructure.Services;

public interface IIngestionQueue
{
    ValueTask EnqueueAsync(DocumentDetectedEvent payload, CancellationToken cancellationToken = default);
    IAsyncEnumerable<DocumentDetectedEvent> ReadAllAsync(CancellationToken cancellationToken);
}

public sealed class InMemoryIngestionQueue : IIngestionQueue
{
    private readonly Channel<DocumentDetectedEvent> _channel = Channel.CreateUnbounded<DocumentDetectedEvent>(new UnboundedChannelOptions
    {
        SingleReader = false,
        SingleWriter = false
    });

    public ValueTask EnqueueAsync(DocumentDetectedEvent payload, CancellationToken cancellationToken = default)
        => _channel.Writer.WriteAsync(payload, cancellationToken);

    public IAsyncEnumerable<DocumentDetectedEvent> ReadAllAsync(CancellationToken cancellationToken)
        => _channel.Reader.ReadAllAsync(cancellationToken);
}
