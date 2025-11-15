namespace CertiWatch.Contracts.Events;

public sealed record RecordApprovedEvent(Guid RecordId, Guid TenantId, Guid? ActorId, DateTime ApprovedAt, string? Notes = null);
