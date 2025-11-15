namespace CertiWatch.Contracts.Requests;

public sealed class UpdateCourseRuleRequest
{
    public string? CourseName { get; init; }
    public string? MatchRegex { get; init; }
    public string? Tag { get; init; }
    public string? IssuerOverride { get; init; }
    public int? DefaultValidityMonths { get; init; }
    public bool? IsRenewable { get; init; }
    public bool? IsOneTime { get; init; }
}
