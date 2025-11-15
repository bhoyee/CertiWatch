using CertiWatch.Contracts.Enums;

namespace CertiWatch.Contracts.Events;

public sealed record ReminderScheduledEvent(Guid RecordId, ReminderType Type, DateTime ScheduledFor, Guid TenantId);
