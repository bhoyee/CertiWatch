namespace CertiWatch.Parsing.Rules;

public sealed class CourseRuleDefinition
{
    public Guid? Id { get; init; }
    public Guid? TenantId { get; init; }
    public string CourseName { get; init; } = string.Empty;
    public string? MatchRegex { get; init; }
    public string? Tag { get; init; }
    public string? IssuerOverride { get; init; }
    public string? VendorOverride { get; init; }
    public int? DefaultValidityMonths { get; init; }
    public bool IsRenewable { get; init; } = true;
    public bool IsOneTime { get; init; }
}
