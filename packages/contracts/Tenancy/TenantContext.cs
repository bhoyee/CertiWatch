namespace CertiWatch.Contracts.Tenancy;

public sealed class TenantContext
{
    public Guid TenantId { get; init; }
    public Guid UserId { get; init; }
    public string Email { get; init; } = string.Empty;
    public string Role { get; init; } = "admin";
}
