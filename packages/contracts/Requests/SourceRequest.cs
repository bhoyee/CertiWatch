using CertiWatch.Contracts.Enums;

namespace CertiWatch.Contracts.Requests;

public sealed class SourceRequest
{
    public required SourceType Type { get; init; }
    public required string DisplayName { get; init; }
    public IDictionary<string, string> Config { get; init; } = new Dictionary<string, string>();
}
