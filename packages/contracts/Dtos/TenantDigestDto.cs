namespace CertiWatch.Contracts.Dtos;

public sealed record TenantDigestDto(
    Guid TenantId,
    string TenantName,
    IReadOnlyList<RecordDto> NewRecords,
    IReadOnlyList<RecordDto> ExpiringSoon,
    IReadOnlyList<RecordDto> Expired,
    IReadOnlyList<RecordDto> LowConfidence
);
