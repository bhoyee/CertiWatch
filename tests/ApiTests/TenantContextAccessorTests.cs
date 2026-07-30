using CertiWatch.Api.Infrastructure.Security;
using CertiWatch.Contracts.Tenancy;
using FluentAssertions;

namespace CertiWatch.Api.Tests;

// Guards the fix for the fail-open bug: an unauthenticated request must never silently resolve
// to a default tenant/admin identity - accessing tenant context before it's set must throw.
public class TenantContextAccessorTests
{
    [Fact]
    public void CurrentThrowsWhenNeverSet()
    {
        var accessor = new TenantContextAccessor();

        var act = () => accessor.Current;

        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void IsSetIsFalseUntilSetIsCalled()
    {
        var accessor = new TenantContextAccessor();

        accessor.IsSet.Should().BeFalse();

        accessor.Set(new TenantContext
        {
            TenantId = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            Email = "admin@example.com",
            Role = "admin"
        });

        accessor.IsSet.Should().BeTrue();
    }

    [Fact]
    public void CurrentReturnsWhatWasSet()
    {
        var accessor = new TenantContextAccessor();
        var tenantId = Guid.NewGuid();

        accessor.Set(new TenantContext
        {
            TenantId = tenantId,
            UserId = Guid.NewGuid(),
            Email = "admin@example.com",
            Role = "admin"
        });

        accessor.Current.TenantId.Should().Be(tenantId);
        accessor.Current.Role.Should().Be("admin");
    }
}
