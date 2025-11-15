namespace CertiWatch.Contracts.Dtos;

public sealed record CourseRuleDto(
    Guid Id,
    Guid? TenantId,
    string CourseName,
    string? MatchRegex,
    string? Tag,
    string? IssuerOverride,
    int? DefaultValidityMonths,
    bool IsRenewable,
    bool IsOneTime,
    int Precedence,
    bool IsGlobal
);
