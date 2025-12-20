using CertiWatch.Contracts.Enums;

namespace CertiWatch.Api.Domain.Entities;

public sealed class UploadRequest : BaseEntity
{
    public Guid TenantId { get; set; }
    public string Token { get; set; } = string.Empty;
    public Guid? CreatedByUserId { get; set; }
    public string? StaffName { get; set; }
    public string? StaffEmail { get; set; }
    public string? CourseName { get; set; }
    public DateOnly? ExpiryHint { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? UsedAt { get; set; }
    public UploadStatus Status { get; set; } = UploadStatus.Pending;
    public string? FilePath { get; set; }
    public string? OriginalFileName { get; set; }
}
