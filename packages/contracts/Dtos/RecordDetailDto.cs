using CertiWatch.Contracts.Enums;

namespace CertiWatch.Contracts.Dtos;

public sealed record RecordDetailDto(
    RecordDto Record,
    DocumentDto Document,
    IReadOnlyList<ReminderDto> Reminders,
    IReadOnlyList<AuditLogDto> AuditTrail,
    IReadOnlyList<string> SuggestedActions
);
