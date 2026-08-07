namespace CertiWatch.Contracts.Requests;

public sealed class CreateRequirementTypeRequest
{
    public required string Name { get; init; }
    public int? DefaultValidityMonths { get; init; }
    public bool IsRenewable { get; init; } = true;
}
