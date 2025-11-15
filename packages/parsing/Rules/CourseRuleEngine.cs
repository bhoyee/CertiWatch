using System.Text.RegularExpressions;
using CertiWatch.Contracts.Rules;

namespace CertiWatch.Parsing.Rules;

public sealed class CourseRuleEngine
{
    private readonly IReadOnlyList<CourseRuleDefinition> _globalRules;

    public CourseRuleEngine(IEnumerable<CourseRuleDefinition> globalRules)
    {
        _globalRules = globalRules.ToList();
    }

    public RuleMatchResult Resolve(
        string? courseName,
        string? issuer,
        IEnumerable<string>? tags,
        IEnumerable<CourseRuleDefinition>? tenantOverrides)
    {
        var tenantRules = (tenantOverrides ?? Array.Empty<CourseRuleDefinition>()).ToList();
        var normalizedCourse = Normalize(courseName);
        var normalizedIssuer = Normalize(issuer);
        var tagSet = new HashSet<string>((tags ?? Array.Empty<string>()).Select(Normalize).Where(v => v is not null)!);

        RuleMatchResult? Decide(IEnumerable<CourseRuleDefinition> rules, RulePrecedence precedence, string reason)
        {
            var rule = rules.FirstOrDefault();
            if (rule is null)
            {
                return null;
            }

            return new RuleMatchResult(
                rule.Id,
                rule.CourseName,
                rule.DefaultValidityMonths,
                true,
                precedence,
                reason);
        }

        RuleMatchResult? TryExactMatch(IEnumerable<CourseRuleDefinition> rules, RulePrecedence precedence, string reason)
            => Decide(rules.Where(r => Normalize(r.CourseName) == normalizedCourse), precedence, reason);

        RuleMatchResult? TryVendorMatch(IEnumerable<CourseRuleDefinition> rules, RulePrecedence precedence, string reason)
            => Decide(rules.Where(r => !string.IsNullOrWhiteSpace(r.VendorOverride) && Normalize(r.VendorOverride) == normalizedIssuer), precedence, reason);

        RuleMatchResult? TryRegexMatch(IEnumerable<CourseRuleDefinition> rules, RulePrecedence precedence, string reason)
            => Decide(
                rules.Where(r => !string.IsNullOrWhiteSpace(r.MatchRegex) && Regex.IsMatch(courseName ?? string.Empty, r.MatchRegex!, RegexOptions.IgnoreCase)),
                precedence,
                reason);

        RuleMatchResult? TryTagMatch(IEnumerable<CourseRuleDefinition> rules, RulePrecedence precedence, string reason)
            => Decide(
                rules.Where(r =>
                {
                    var tag = Normalize(r.Tag);
                    return tag is not null && tagSet.Contains(tag);
                }),
                precedence,
                reason);

        RuleMatchResult? TryDefaults(IEnumerable<CourseRuleDefinition> rules, RulePrecedence precedence, string reason)
            => Decide(
                rules.Where(r => r.CourseName == "*"),
                precedence,
                reason);

        return
            TryExactMatch(tenantRules, RulePrecedence.CompanyExact, "Tenant exact match") ??
            TryVendorMatch(tenantRules, RulePrecedence.CompanyVendorOverride, "Tenant vendor override") ??
            TryRegexMatch(tenantRules, RulePrecedence.CompanyRegex, "Tenant regex match") ??
            TryExactMatch(_globalRules, RulePrecedence.GlobalExact, "Global exact match") ??
            TryVendorMatch(_globalRules, RulePrecedence.GlobalVendorOverride, "Global vendor override") ??
            TryRegexMatch(_globalRules, RulePrecedence.GlobalRegex, "Global regex match") ??
            TryTagMatch(_globalRules.Concat(tenantRules), RulePrecedence.Tag, "Tag match") ??
            TryDefaults(tenantRules, RulePrecedence.CompanyDefault, "Tenant default") ??
            new RuleMatchResult(null, courseName ?? "Unknown Course", 12, true, RulePrecedence.Fallback, "Fallback 12 month guess");
    }

    private static string? Normalize(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim().ToLowerInvariant();
}
