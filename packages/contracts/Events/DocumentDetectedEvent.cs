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
    decimal? ExtractionConfidence = null,
    // Set only when this file came from a Google Drive/OneDrive source (see CloudImportWorker
    // and OcrWorker.ResolveCloudFileId in apps/worker) - the id of the file at its provider.
    // When present, the API stores a reference back to it instead of archiving a permanent copy
    // into its own storage (see DocumentIngestionWorker.SetCloudReference).
    string? CloudFileId = null
);
