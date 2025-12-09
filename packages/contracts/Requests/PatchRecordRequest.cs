using CertiWatch.Contracts.Enums;

namespace CertiWatch.Contracts.Requests;

public sealed class PatchRecordRequest
{
    public string? StaffName { get; init; }
    public string? CourseName { get; init; }
    public string? Issuer { get; init; }
    public DateOnly? IssueDate { get; init; }
    public DateOnly? ExpiryDate { get; init; }
    public bool? ExpiryDerived { get; init; }
    public bool? Ignore { get; init; }
    public decimal? Confidence { get; init; }
    public ProcessingStatus? ProcessingStatus { get; init; }
    public string? ReviewReason { get; init; }
    public string? ReviewNotes { get; init; }
    public decimal? ExtractionConfidence { get; init; }
}
