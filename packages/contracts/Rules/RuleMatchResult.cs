namespace CertiWatch.Contracts.Rules;

public sealed record RuleMatchResult(
    Guid? RuleId,
    string CourseName,
    int? ValidityMonths,
    bool ExpiryDerived,
    RulePrecedence Precedence,
    string? Reason
);
