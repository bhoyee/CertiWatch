using System.Net;
using System.Net.Http.Json;
using CertiWatch.Api.Domain.Entities;
using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Tests.Infrastructure;
using CertiWatch.Contracts.Dtos;
using CertiWatch.Contracts.Enums;
using CertiWatch.Contracts.Responses;
using FluentAssertions;
using Record = CertiWatch.Api.Domain.Entities.Record;

namespace CertiWatch.Api.Tests;

[Collection(ApiTestCollection.Name)]
public class TenantIsolationTests
{
    private readonly ApiTestFixture _fixture;

    public TenantIsolationTests(ApiTestFixture fixture) => _fixture = fixture;

    [Fact]
    public async Task RecordsListNeverLeaksAnotherTenantsData()
    {
        var (tenantA, adminAEmail) = await SeedTenantWithAdminAsync();
        var (tenantB, _) = await SeedTenantWithAdminAsync();

        await _fixture.SeedAsync(async db =>
        {
            AddRecord(db, tenantA, "Tenant A Staff");
            AddRecord(db, tenantB, "Tenant B Staff");
            await db.SaveChangesAsync();
        });

        var client = _fixture.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/records");
        request.Headers.Add("Cookie", $"cw_session={SessionTokens.Create(adminAEmail, tenantA, "admin")}");
        var response = await client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var page = await response.Content.ReadFromJsonAsync<PagedResult<RecordDto>>();
        page.Should().NotBeNull();
        page!.Items.Should().ContainSingle(r => r.StaffName == "Tenant A Staff");
        page.Items.Should().NotContain(r => r.StaffName == "Tenant B Staff");
    }

    [Fact]
    public async Task DevicesListNeverLeaksAnotherTenantsDevices()
    {
        var (tenantA, adminAEmail) = await SeedTenantWithAdminAsync();
        var (tenantB, _) = await SeedTenantWithAdminAsync();

        await _fixture.SeedAsync(async db =>
        {
            db.Devices.Add(new Device { Id = Guid.NewGuid(), TenantId = tenantA, Name = "Tenant A Device", OperatingSystem = "linux", DeviceToken = "token-a" });
            db.Devices.Add(new Device { Id = Guid.NewGuid(), TenantId = tenantB, Name = "Tenant B Device", OperatingSystem = "linux", DeviceToken = "token-b" });
            await db.SaveChangesAsync();
        });

        var client = _fixture.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/devices");
        request.Headers.Add("Cookie", $"cw_session={SessionTokens.Create(adminAEmail, tenantA, "admin")}");
        var response = await client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var devices = await response.Content.ReadFromJsonAsync<List<DeviceDto>>();
        devices.Should().NotBeNull();
        devices!.Should().ContainSingle(d => d.Name == "Tenant A Device");
        devices.Should().NotContain(d => d.Name == "Tenant B Device");
    }

    [Fact]
    public async Task ADevicesSessionCannotBeUsedToDeleteAnotherTenantsDevice()
    {
        var (tenantA, adminAEmail) = await SeedTenantWithAdminAsync();
        var (tenantB, _) = await SeedTenantWithAdminAsync();

        var tenantBDeviceId = Guid.NewGuid();
        await _fixture.SeedAsync(async db =>
        {
            db.Devices.Add(new Device { Id = tenantBDeviceId, TenantId = tenantB, Name = "Tenant B Device", OperatingSystem = "linux", DeviceToken = "token-b" });
            await db.SaveChangesAsync();
        });

        var client = _fixture.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Delete, $"/api/devices/{tenantBDeviceId}");
        request.Headers.Add("Cookie", $"cw_session={SessionTokens.Create(adminAEmail, tenantA, "admin")}");
        var response = await client.SendAsync(request);

        // The endpoint scopes its lookup by tenant, so a cross-tenant id is indistinguishable
        // from one that doesn't exist at all - it must never succeed either way.
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);

        await _fixture.SeedAsync(async db =>
        {
            var stillThere = await db.Devices.FindAsync(tenantBDeviceId);
            stillThere.Should().NotBeNull();
        });
    }

    private static void AddRecord(AppDbContext db, Guid tenantId, string staffName)
    {
        var source = new Source { Id = Guid.NewGuid(), TenantId = tenantId, Type = SourceType.Local, DisplayName = "Test Source" };
        var document = new Document { Id = Guid.NewGuid(), TenantId = tenantId, SourceId = source.Id, FileName = "cert.pdf", FileHash = Guid.NewGuid().ToString("N") };
        var record = new Record
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            DocumentId = document.Id,
            StaffName = staffName,
            CourseName = "First Aid",
            ProcessingStatus = ProcessingStatus.Ok
        };
        db.AddRange(source, document, record);
    }

    private async Task<(Guid TenantId, string AdminEmail)> SeedTenantWithAdminAsync()
    {
        var tenantId = Guid.NewGuid();
        var email = $"{Guid.NewGuid():N}@example.com";
        await _fixture.SeedAsync(async db =>
        {
            db.Tenants.Add(new Tenant { Id = tenantId, Name = $"Tenant {tenantId:N}" });
            db.Users.Add(new User { Id = Guid.NewGuid(), TenantId = tenantId, Email = email, Role = "admin" });
            await db.SaveChangesAsync();
        });
        return (tenantId, email);
    }
}
