namespace CertiWatch.Contracts.Dtos;

public sealed record ComplianceRowDto(
    Guid StaffId,
    string StaffName,
    string? JobTitle,
    IReadOnlyList<ComplianceCellDto> Cells
);
