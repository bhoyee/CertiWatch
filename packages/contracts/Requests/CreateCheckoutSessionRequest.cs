namespace CertiWatch.Contracts.Requests;

public sealed class CreateCheckoutSessionRequest
{
    public required string CompanyName { get; init; }
    public required string AdminName { get; init; }
    public required string AdminEmail { get; init; }
    public required string PlanId { get; init; }
}
