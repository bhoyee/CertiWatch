namespace CertiWatch.Contracts.Dtos;

public sealed record AuditLogDto(
    Guid Id,
    Guid? ActorId,
    string Action,
    IReadOnlyDictionary<string, object> Meta,
    DateTime CreatedAt
);
