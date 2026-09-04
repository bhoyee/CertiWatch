using System.Net;
using System.Net.Http.Json;
using CertiWatch.Api.Domain.Entities;
using CertiWatch.Api.Features.Auth;
using CertiWatch.Api.Tests.Infrastructure;
using CertiWatch.Contracts.Responses;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;

namespace CertiWatch.Api.Tests;

[Collection(ApiTestCollection.Name)]
public class MagicLinkFlowTests
{
    private readonly ApiTestFixture _fixture;

    public MagicLinkFlowTests(ApiTestFixture fixture) => _fixture = fixture;

    [Fact]
    public async Task VerifyingAValidMagicTokenIssuesASessionThatActuallyAuthenticates()
    {
        var tenantId = Guid.NewGuid();
        var email = $"{Guid.NewGuid():N}@example.com";
        await _fixture.SeedAsync(async db =>
        {
            db.Tenants.Add(new Tenant { Id = tenantId, Name = "Test Care Home" });
            db.Users.Add(new User { Id = Guid.NewGuid(), TenantId = tenantId, Email = email, Role = "admin" });
            await db.SaveChangesAsync();
        });

        var magicToken = MagicLinkTokenService.CreateToken(
            email, tenantId, ApiTestFixture.MagicLinkSecret, TimeSpan.FromMinutes(10), purpose: "magic");

        var client = _fixture.CreateClient();
        var verifyResponse = await client.GetAsync($"/api/auth/magic-link/verify?token={Uri.EscapeDataString(magicToken)}");

        verifyResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await verifyResponse.Content.ReadFromJsonAsync<MagicLinkVerifyResponse>();
        body.Should().NotBeNull();
        body!.Email.Should().Be(email);
        body.TenantId.Should().Be(tenantId);
        body.Token.Should().NotBeNullOrWhiteSpace();

        // The whole point of the flow: the session token /verify just handed back must actually
        // authenticate a subsequent request, not just look well-formed.
        using var authedRequest = new HttpRequestMessage(HttpMethod.Get, "/api/staff");
        authedRequest.Headers.Add("Cookie", $"cw_session={body.Token}");
        var authedResponse = await client.SendAsync(authedRequest);
        authedResponse.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task TokenSignedWithTheWrongSecretIsRejected()
    {
        var tenantId = Guid.NewGuid();
        var email = $"{Guid.NewGuid():N}@example.com";
        await _fixture.SeedAsync(async db =>
        {
            db.Tenants.Add(new Tenant { Id = tenantId, Name = "Test Care Home" });
            db.Users.Add(new User { Id = Guid.NewGuid(), TenantId = tenantId, Email = email, Role = "admin" });
            await db.SaveChangesAsync();
        });

        var tampered = MagicLinkTokenService.CreateToken(
            email, tenantId, "a-completely-different-secret", TimeSpan.FromMinutes(10), purpose: "magic");

        var client = _fixture.CreateClient();
        var response = await client.GetAsync($"/api/auth/magic-link/verify?token={Uri.EscapeDataString(tampered)}");

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task ExpiredMagicTokenIsRejected()
    {
        var tenantId = Guid.NewGuid();
        var email = $"{Guid.NewGuid():N}@example.com";
        await _fixture.SeedAsync(async db =>
        {
            db.Tenants.Add(new Tenant { Id = tenantId, Name = "Test Care Home" });
            db.Users.Add(new User { Id = Guid.NewGuid(), TenantId = tenantId, Email = email, Role = "admin" });
            await db.SaveChangesAsync();
        });

        var expired = MagicLinkTokenService.CreateToken(
            email, tenantId, ApiTestFixture.MagicLinkSecret, TimeSpan.FromSeconds(-1), purpose: "magic");

        var client = _fixture.CreateClient();
        var response = await client.GetAsync($"/api/auth/magic-link/verify?token={Uri.EscapeDataString(expired)}");

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task ASessionTokenPurposeIsRejectedAtTheMagicLinkVerifyEndpoint()
    {
        // /verify only accepts "magic"-purpose tokens - a "session" token (the kind CwSession
        // auth itself consumes) must not double as a way back into /verify.
        var tenantId = Guid.NewGuid();
        var email = $"{Guid.NewGuid():N}@example.com";
        await _fixture.SeedAsync(async db =>
        {
            db.Tenants.Add(new Tenant { Id = tenantId, Name = "Test Care Home" });
            db.Users.Add(new User { Id = Guid.NewGuid(), TenantId = tenantId, Email = email, Role = "admin" });
            await db.SaveChangesAsync();
        });

        var sessionToken = SessionTokens.Create(email, tenantId, "admin");

        var client = _fixture.CreateClient();
        var response = await client.GetAsync($"/api/auth/magic-link/verify?token={Uri.EscapeDataString(sessionToken)}");

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task SessionIsRejectedOnceTheUserIsDisabledEvenWithAStillValidToken()
    {
        var tenantId = Guid.NewGuid();
        var email = $"{Guid.NewGuid():N}@example.com";
        await _fixture.SeedAsync(async db =>
        {
            db.Tenants.Add(new Tenant { Id = tenantId, Name = "Test Care Home" });
            db.Users.Add(new User { Id = Guid.NewGuid(), TenantId = tenantId, Email = email, Role = "admin", IsDisabled = false });
            await db.SaveChangesAsync();
        });

        var sessionToken = SessionTokens.Create(email, tenantId, "admin");
        var client = _fixture.CreateClient();

        using (var request = new HttpRequestMessage(HttpMethod.Get, "/api/staff"))
        {
            request.Headers.Add("Cookie", $"cw_session={sessionToken}");
            var response = await client.SendAsync(request);
            response.StatusCode.Should().Be(HttpStatusCode.OK);
        }

        await _fixture.SeedAsync(async db =>
        {
            var user = await db.Users.SingleAsync(u => u.Email == email);
            user.IsDisabled = true;
            await db.SaveChangesAsync();
        });

        using (var request = new HttpRequestMessage(HttpMethod.Get, "/api/staff"))
        {
            request.Headers.Add("Cookie", $"cw_session={sessionToken}");
            var response = await client.SendAsync(request);
            response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        }
    }
}
