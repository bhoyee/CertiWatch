using CertiWatch.Parsing.Rules;
using FluentAssertions;

namespace CertiWatch.Api.Tests;

public class RuleEngineTests
{
    [Fact]
    public void UsesTenantOverrideWhenConfigured()
    {
        var global = new[]
        {
            new CourseRuleDefinition { CourseName = "First Aid", DefaultValidityMonths = 36 }
        };
        var tenantRules = new[]
        {
            new CourseRuleDefinition { TenantId = Guid.NewGuid(), CourseName = "First Aid", DefaultValidityMonths = 12 }
        };

        var engine = new CourseRuleEngine(global);
        var match = engine.Resolve("First Aid", null, null, tenantRules);

        match.Should().NotBeNull();
        match!.ValidityMonths.Should().Be(12);
    }

    [Fact]
    public void FallsBackToGlobalRule()
    {
        var engine = new CourseRuleEngine(new[]
        {
            new CourseRuleDefinition { CourseName = "Manual Handling", DefaultValidityMonths = 24 }
        });

        var match = engine.Resolve("Manual Handling", null, null, Array.Empty<CourseRuleDefinition>());

        match.Should().NotBeNull();
        match!.ValidityMonths.Should().Be(24);
    }
}
