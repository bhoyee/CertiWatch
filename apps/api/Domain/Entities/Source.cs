using CertiWatch.Contracts.Enums;

namespace CertiWatch.Api.Domain.Entities;

public sealed class Source : BaseEntity
{
    public Guid TenantId { get; set; }
    public SourceType Type { get; set; }
    public required string DisplayName { get; set; }
    public string ConfigJson { get; set; } = "{}";
    public Tenant? Tenant { get; set; }
}
