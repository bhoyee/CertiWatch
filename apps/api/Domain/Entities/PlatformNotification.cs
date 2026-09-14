namespace CertiWatch.Api.Domain.Entities;

// Platform-wide, not per-superadmin: mirrors Notification's tenant-wide model, but there's no
// tenant to scope by here - CertiWatch's own staff act as one team, so any of them marking a
// notification read dismisses it for the whole platform console.
public sealed class PlatformNotification : BaseEntity
{
    public Guid TicketId { get; set; }
    public Guid TenantId { get; set; }
    public string Type { get; set; } = "support_reply"; // "support_reply" | "support_status"
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public bool IsRead { get; set; }
    public DateTime? ReadAt { get; set; }
}
