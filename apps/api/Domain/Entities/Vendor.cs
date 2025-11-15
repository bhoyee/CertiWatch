namespace CertiWatch.Api.Domain.Entities;

public sealed class Vendor : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string HintsJson { get; set; } = "[]";
    public string PatternsJson { get; set; } = "{}";
}
