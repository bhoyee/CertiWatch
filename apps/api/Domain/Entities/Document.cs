using CertiWatch.Contracts.Enums;

namespace CertiWatch.Api.Domain.Entities;

public sealed class Document : BaseEntity
{
    public Guid TenantId { get; set; }
    public Guid SourceId { get; set; }
    public Guid? VendorId { get; set; }
    public string PathOrUrl { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string FileHash { get; set; } = string.Empty;
    public string MimeType { get; set; } = "application/pdf";
    public string? DocumentType { get; set; }
    public decimal? ExtractionConfidence { get; set; }
    public DateTime? ProcessedAt { get; set; }
    public ProcessingStatus ProcessingStatus { get; set; } = ProcessingStatus.Pending;
    public Source? Source { get; set; }
    public Vendor? Vendor { get; set; }
    public ICollection<Record> Records { get; set; } = new List<Record>();
}
