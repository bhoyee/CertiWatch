using CertiWatch.Contracts.Enums;

namespace CertiWatch.Api.Domain.Entities;

public sealed class Reminder : BaseEntity
{
    public Guid TenantId { get; set; }
    public Guid RecordId { get; set; }
    public ReminderType Type { get; set; }
    public DateTime ScheduledFor { get; set; }
    public DateTime? SentAt { get; set; }
    public Record? Record { get; set; }
}
