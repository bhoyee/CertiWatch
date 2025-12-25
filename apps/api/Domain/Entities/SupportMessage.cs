using System.ComponentModel.DataAnnotations;

namespace CertiWatch.Api.Domain.Entities;

public class SupportMessage
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TicketId { get; set; }
    public Guid? AuthorUserId { get; set; }
    public string Body { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public SupportTicket? Ticket { get; set; }
}
