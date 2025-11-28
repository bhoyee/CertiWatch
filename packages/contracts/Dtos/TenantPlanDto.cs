namespace CertiWatch.Contracts.Dtos;

public sealed record TenantPlanDto(
    string TenantName,
    string PlanId,
    string PlanName,
    int RecordLimit,
    int RecordCount,
    int DeviceCount,
    int SourceCount);
