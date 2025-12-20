using CertiWatch.Contracts.Enums;

namespace CertiWatch.Contracts.Events;

public sealed record DocumentDetectedEvent(
    Guid TenantId,
    Guid SourceId,
    string DeviceToken,
    Guid? CreatedByUserId,
    string FileName,
    string PathOrUrl,
    string FileHash,
    string MimeType,
    long FileSize,
    IReadOnlyList<string> VendorHints,
    IReadOnlyDictionary<string, string> ExtractedFields,
    ProcessingStatus InitialStatus,
    DateTime DetectedAt,
    string? DocumentType = null,
    decimal? ExtractionConfidence = null
);
