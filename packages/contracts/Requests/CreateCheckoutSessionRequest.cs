namespace CertiWatch.Contracts.Requests;

public sealed class CreateCheckoutSessionRequest
{
    // Made nullable to allow logged-in upgrades without re-sending identity
    public string? CompanyName { get; init; }
    public string? AdminName { get; init; }
    public string? AdminEmail { get; init; }
    public required string PlanId { get; init; }
}
