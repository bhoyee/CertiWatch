namespace CertiWatch.Api.Domain.Entities;

// Tenant-wide, not per-user: matches how Reminders/CourseRules already work in this app (a
// tenant's admins/managers act as one team, not individually-tracked inboxes), so marking a
// notification read dismisses it for the whole tenant rather than needing a per-user read table.
public sealed class Notification : BaseEntity
{
    public Guid TenantId { get; set; }
    public Guid? RecordId { get; set; }
    public string Type { get; set; } = "expiring"; // "expiring" | "expired" | "needs_review"
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public bool IsRead { get; set; }
    public DateTime? ReadAt { get; set; }
}
