using CertiWatch.Api.Features.Devices;
using CertiWatch.Api.Infrastructure.Services;
using FluentAssertions;

namespace CertiWatch.Api.Tests;

public class DeviceUploadPolicyTests
{
    [Theory]
    [InlineData("certificate.pdf", true)]
    [InlineData("scan.PNG", true)]
    [InlineData("photo.jpeg", true)]
    [InlineData("photo.JPG", true)]
    [InlineData("archive.zip", false)]
    [InlineData("script.exe", false)]
    [InlineData("noextension", false)]
    public void IsAllowedExtensionMatchesTheServerAllowlistCaseInsensitively(string fileName, bool expected)
    {
        DeviceUploadPolicy.IsAllowedExtension(fileName).Should().Be(expected);
    }

    [Fact]
    public void ExceedsMaxSizeAllowsFilesAtOrUnderTheCap()
    {
        DeviceUploadPolicy.ExceedsMaxSize(DeviceUploadPolicy.MaxUploadSizeBytes).Should().BeFalse();
        DeviceUploadPolicy.ExceedsMaxSize(DeviceUploadPolicy.MaxUploadSizeBytes - 1).Should().BeFalse();
    }

    [Fact]
    public void ExceedsMaxSizeRejectsFilesOverTheCap()
    {
        DeviceUploadPolicy.ExceedsMaxSize(DeviceUploadPolicy.MaxUploadSizeBytes + 1).Should().BeTrue();
    }
}

public class DeviceUploadRateLimiterTests
{
    [Fact]
    public void AllowsRequestsAtOrUnderTheCap()
    {
        DeviceUploadRateLimiter.IsWithinLimit(1).Should().BeTrue();
        DeviceUploadRateLimiter.IsWithinLimit(DeviceUploadRateLimiter.MaxPerMinute).Should().BeTrue();
    }

    [Fact]
    public void BlocksRequestsOverTheCap()
    {
        DeviceUploadRateLimiter.IsWithinLimit(DeviceUploadRateLimiter.MaxPerMinute + 1).Should().BeFalse();
    }
}
