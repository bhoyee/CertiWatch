namespace CertiWatch.Contracts.Dtos;

public sealed record RequirementTypeDto(
    Guid Id,
    Guid? TenantId,
    string Name,
    int? DefaultValidityMonths,
    bool IsRenewable,
    bool IsGlobal
);
