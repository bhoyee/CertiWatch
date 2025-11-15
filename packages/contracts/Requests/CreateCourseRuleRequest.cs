namespace CertiWatch.Contracts.Requests;

public sealed class CreateCourseRuleRequest
{
    public required string CourseName { get; init; }
    public string? MatchRegex { get; init; }
    public string? Tag { get; init; }
    public string? IssuerOverride { get; init; }
    public int? DefaultValidityMonths { get; init; }
    public bool IsRenewable { get; init; } = true;
    public bool IsOneTime { get; init; }
}
