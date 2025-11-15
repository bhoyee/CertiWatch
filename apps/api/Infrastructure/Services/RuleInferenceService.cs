using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Contracts.Rules;
using CertiWatch.Parsing.Rules;
using Microsoft.EntityFrameworkCore;

namespace CertiWatch.Api.Infrastructure.Services;

public interface IRuleInferenceService
{
    Task<RuleMatchResult?> InferAsync(Guid tenantId, string? courseName, string? issuer, IEnumerable<string>? tags, DateOnly? issueDate, CancellationToken cancellationToken);
}

public sealed class RuleInferenceService(AppDbContext dbContext) : IRuleInferenceService
{
    public async Task<RuleMatchResult?> InferAsync(Guid tenantId, string? courseName, string? issuer, IEnumerable<string>? tags, DateOnly? issueDate, CancellationToken cancellationToken)
    {
        if (issueDate is null)
        {
            return null;
        }

        var globalRules = await dbContext.CourseRules
            .AsNoTracking()
            .Where(r => r.TenantId == null)
            .Select(r => new CourseRuleDefinition
            {
                Id = r.Id,
                TenantId = r.TenantId,
                CourseName = r.CourseName,
                MatchRegex = r.MatchRegex,
                Tag = r.Tag,
                IssuerOverride = r.IssuerOverride,
                DefaultValidityMonths = r.DefaultValidityMonths,
                IsOneTime = r.IsOneTime,
                IsRenewable = r.IsRenewable
            })
            .ToListAsync(cancellationToken);

        var tenantRules = await dbContext.CourseRules
            .AsNoTracking()
            .Where(r => r.TenantId == tenantId)
            .Select(r => new CourseRuleDefinition
            {
                Id = r.Id,
                TenantId = r.TenantId,
                CourseName = r.CourseName,
                MatchRegex = r.MatchRegex,
                Tag = r.Tag,
                IssuerOverride = r.IssuerOverride,
                DefaultValidityMonths = r.DefaultValidityMonths,
                IsOneTime = r.IsOneTime,
                IsRenewable = r.IsRenewable
            })
            .ToListAsync(cancellationToken);

        var engine = new CourseRuleEngine(globalRules);
        return engine.Resolve(courseName, issuer, tags, tenantRules);
    }
}
