using CertiWatch.Api.Infrastructure.Security;
using FluentAssertions;

namespace CertiWatch.Api.Tests;

public class DeviceSecretsTests
{
    [Fact]
    public void HashIsDeterministicForTheSameInput()
    {
        DeviceSecrets.Hash("local-dev").Should().Be(DeviceSecrets.Hash("local-dev"));
    }

    [Fact]
    public void HashDiffersForDifferentInput()
    {
        DeviceSecrets.Hash("local-dev").Should().NotBe(DeviceSecrets.Hash("something-else"));
    }

    [Fact]
    public void GeneratedEnrollmentCodesAreUniqueAndUrlSafe()
    {
        var codes = Enumerable.Range(0, 50).Select(_ => DeviceSecrets.GenerateEnrollmentCode()).ToList();

        codes.Should().OnlyHaveUniqueItems();
        codes.Should().OnlyContain(c => c.All(ch => char.IsLetterOrDigit(ch)));
    }

    [Fact]
    public void ConstantTimeEqualsMatchesIdenticalStrings()
    {
        DeviceSecrets.ConstantTimeEquals("same-token", "same-token").Should().BeTrue();
    }

    [Theory]
    [InlineData("token-a", "token-b")]
    [InlineData("short", "much-longer-token")]
    [InlineData(null, "token")]
    [InlineData("token", null)]
    public void ConstantTimeEqualsRejectsMismatches(string? a, string? b)
    {
        DeviceSecrets.ConstantTimeEquals(a, b).Should().BeFalse();
    }
}
