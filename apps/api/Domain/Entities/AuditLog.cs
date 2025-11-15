namespace CertiWatch.Api.Domain.Entities;

public sealed class AuditLog : BaseEntity
{
    public Guid TenantId { get; set; }
    public Guid? ActorId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string MetaJson { get; set; } = "{}";
}
