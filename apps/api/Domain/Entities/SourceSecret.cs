namespace CertiWatch.Api.Domain.Entities;

public sealed class SourceSecret : BaseEntity
{
    public Guid TenantId { get; set; }
    public Guid SourceId { get; set; }
    public required string Key { get; set; }
    public required string Value { get; set; }
    public Source? Source { get; set; }
}
