using CertiWatch.Contracts.Events;

namespace CertiWatch.Contracts.Requests;

public sealed class DeviceEventRequest
{
    public required Guid DeviceId { get; init; }
    public required IReadOnlyList<DocumentDetectedEvent> Documents { get; init; }
}
