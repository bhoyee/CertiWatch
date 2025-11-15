namespace CertiWatch.Contracts.Requests;

public sealed class DeviceHeartbeatRequest
{
    public required Guid DeviceId { get; init; }
    public required string Version { get; init; }
    public IReadOnlyDictionary<string, string>? Sources { get; init; }
}
