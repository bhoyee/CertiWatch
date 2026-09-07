using System.ComponentModel.DataAnnotations;

namespace CertiWatch.Api.Domain.Entities;

public class SupportAttachment
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }

    // Null until the ticket it belongs to is actually created - lets the rich text editor upload
    // an inline image, or the "new ticket" form attach a file, before a ticket id exists yet. The
    // upload is re-parented to the real ticket (and, for a reply, the new message) once submitted.
    public Guid? TicketId { get; set; }
    public Guid? MessageId { get; set; }

    public string FileName { get; set; } = string.Empty;
    public string? MimeType { get; set; }
    public long SizeBytes { get; set; }
    public string PathOrUrl { get; set; } = string.Empty;
    public Guid? UploadedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
