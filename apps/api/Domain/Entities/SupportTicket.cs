using System.ComponentModel.DataAnnotations;

namespace CertiWatch.Api.Domain.Entities;

public class SupportTicket
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? CreatedByUserId { get; set; }
    public Guid? AssignedToUserId { get; set; }
    public string AssignedRole { get; set; } = "manager"; // manager | admin | support
    public string Subject { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string Status { get; set; } = "open"; // open, closed
    public string? Priority { get; set; } // optional
    public Guid? RecordId { get; set; }
    public string? PageContext { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<SupportMessage> Messages { get; set; } = new List<SupportMessage>();
}
