using CertiWatch.Contracts.Enums;

namespace CertiWatch.Contracts.Dtos;

public sealed record ReminderDto(
    Guid Id,
    ReminderType Type,
    Guid RecordId,
    DateTime ScheduledFor,
    DateTime? SentAt
);
