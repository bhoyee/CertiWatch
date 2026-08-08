namespace CertiWatch.Contracts.Dtos;

// Columns (RequirementTypes) and rows are shipped together so the frontend never has to do a
// second lookup to know each column's name/validity - Cells within a row line up positionally
// with RequirementTypes.
public sealed record ComplianceMatrixDto(
    IReadOnlyList<RequirementTypeDto> RequirementTypes,
    IReadOnlyList<ComplianceRowDto> Rows
);
