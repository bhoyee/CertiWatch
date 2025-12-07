using CertiWatch.Contracts.Enums;

namespace CertiWatch.Contracts.Dtos;

public sealed record DocumentDto(
    Guid Id,
    Guid TenantId,
    Guid SourceId,
    string FileName,
    string? PathOrUrl,
    string? FileHash,
    string MimeType,
    ProcessingStatus ProcessingStatus,
    DateTime CreatedAt,
    DateTime? ProcessedAt,
    string? DocumentType,
    decimal? ExtractionConfidence
);
