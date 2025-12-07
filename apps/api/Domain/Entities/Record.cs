using CertiWatch.Contracts.Enums;

namespace CertiWatch.Api.Domain.Entities;

public sealed class Record : BaseEntity
{
    public Guid TenantId { get; set; }
    public Guid DocumentId { get; set; }
    public string StaffName { get; set; } = string.Empty;
    public string CourseName { get; set; } = string.Empty;
    public string? Issuer { get; set; }
    public DateOnly? IssueDate { get; set; }
    public DateOnly? ExpiryDate { get; set; }
    public bool ExpiryDerived { get; set; }
    public string? DocumentType { get; set; }
    public decimal? ExtractionConfidence { get; set; }
    public decimal Confidence { get; set; }
    public ProcessingStatus ProcessingStatus { get; set; } = ProcessingStatus.Pending;
    public string FieldsJson { get; set; } = "{}";
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public Document? Document { get; set; }
    public ICollection<Reminder> Reminders { get; set; } = new List<Reminder>();
}
