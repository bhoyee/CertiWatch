using CertiWatch.Contracts.Enums;

namespace CertiWatch.Contracts.Dtos;

public sealed record RecordDto(
    Guid Id,
    Guid TenantId,
    Guid DocumentId,
    string StaffName,
    string CourseName,
    string? Issuer,
    DateOnly? IssueDate,
    DateOnly? ExpiryDate,
    bool ExpiryDerived,
    decimal Confidence,
    RecordConfidenceBand ConfidenceBand,
    ProcessingStatus ProcessingStatus,
    IReadOnlyDictionary<string, string>? Fields,
    DateTime CreatedAt,
    DateTime UpdatedAt
);
