namespace CertiWatch.Contracts.Requests;

public sealed class AuthLoginRequest
{
    public required string Email { get; init; }
    public required string Tenant { get; init; }
}
