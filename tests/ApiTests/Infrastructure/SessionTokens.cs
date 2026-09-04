using CertiWatch.Api.Features.Auth;

namespace CertiWatch.Api.Tests.Infrastructure;

// Builds a "session"-purpose token exactly like /api/auth/magic-link/verify would issue, signed
// with the same secret the test host is configured with (see ApiTestFixture.MagicLinkSecret) - so
// tests can authenticate as a given tenant/role without round-tripping through email delivery
// every time. Attach it as: request.Headers.Add("Cookie", $"cw_session={token}").
public static class SessionTokens
{
    public static string Create(string email, Guid tenantId, string role, TimeSpan? lifetime = null)
        => MagicLinkTokenService.CreateToken(
            email,
            tenantId,
            ApiTestFixture.MagicLinkSecret,
            lifetime ?? TimeSpan.FromHours(1),
            purpose: "session",
            role: role);
}
