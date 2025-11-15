namespace CertiWatch.Contracts.Requests;

public sealed class MagicLinkRequest
{
    public required string Token { get; init; }
    public required string Payload { get; init; }
    public string? Action { get; init; }
    public Guid? RecordId { get; init; }
}
