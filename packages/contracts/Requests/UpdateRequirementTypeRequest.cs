namespace CertiWatch.Contracts.Requests;

public sealed class UpdateRequirementTypeRequest
{
    public string? Name { get; init; }
    public int? DefaultValidityMonths { get; init; }
    public bool? IsRenewable { get; init; }
}
