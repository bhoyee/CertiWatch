using System.Net;
using System.Net.Http.Json;
using CertiWatch.Api.Domain.Entities;
using CertiWatch.Api.Tests.Infrastructure;
using CertiWatch.Contracts.Dtos;
using CertiWatch.Contracts.Enums;
using FluentAssertions;
using Record = CertiWatch.Api.Domain.Entities.Record;

namespace CertiWatch.Api.Tests;

[Collection(ApiTestCollection.Name)]
public class ComplianceMatrixTests
{
    private readonly ApiTestFixture _fixture;

    public ComplianceMatrixTests(ApiTestFixture fixture) => _fixture = fixture;

    [Fact]
    public async Task MatrixComputesEveryStatusCorrectly()
    {
        var tenantId = Guid.NewGuid();
        var adminEmail = $"{Guid.NewGuid():N}@example.com";
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var staffId = Guid.NewGuid();

        // "ZTest " prefix is deliberate: RequirementType has real seeded rows baked into the
        // migrations (First Aid, DBS Check, etc. - see AppDbContext.OnModelCreating's HasData),
        // and BuildMatrixAsync includes every global (TenantId == null) row for every tenant. A
        // same-named tenant-scoped row here would collide with one of those in the response.
        await _fixture.SeedAsync(async db =>
        {
            db.Tenants.Add(new Tenant { Id = tenantId, Name = "Compliance Test Home" });
            db.Users.Add(new User { Id = Guid.NewGuid(), TenantId = tenantId, Email = adminEmail, Role = "admin" });
            db.StaffMembers.Add(new StaffMember { Id = staffId, TenantId = tenantId, Name = "Jane Carer", IsActive = true });

            db.RequirementTypes.AddRange(
                new RequirementType { Id = Guid.NewGuid(), TenantId = tenantId, Name = "ZTest Expiring Soon", IsRenewable = true, DefaultValidityMonths = 12 },
                new RequirementType { Id = Guid.NewGuid(), TenantId = tenantId, Name = "ZTest No Fixed Expiry", IsRenewable = true, DefaultValidityMonths = null },
                new RequirementType { Id = Guid.NewGuid(), TenantId = tenantId, Name = "ZTest One Time", IsRenewable = false, DefaultValidityMonths = null },
                new RequirementType { Id = Guid.NewGuid(), TenantId = tenantId, Name = "ZTest Expired", IsRenewable = true, DefaultValidityMonths = 36 },
                new RequirementType { Id = Guid.NewGuid(), TenantId = tenantId, Name = "ZTest Never Uploaded", IsRenewable = true, DefaultValidityMonths = 12 });

            var source = new Source { Id = Guid.NewGuid(), TenantId = tenantId, Type = SourceType.Local, DisplayName = "Test Source" };
            db.Sources.Add(source);

            void AddRecord(string course, DateOnly? expiry)
            {
                var document = new Document
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    SourceId = source.Id,
                    FileName = $"{course}.pdf",
                    FileHash = Guid.NewGuid().ToString("N")
                };
                db.Documents.Add(document);
                db.Records.Add(new Record
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    DocumentId = document.Id,
                    StaffName = "Jane Carer",
                    CourseName = course,
                    ExpiryDate = expiry,
                    ProcessingStatus = ProcessingStatus.Ok
                });
            }

            AddRecord("ZTest Expiring Soon", today.AddDays(10));
            AddRecord("ZTest No Fixed Expiry", null);
            AddRecord("ZTest One Time", today.AddDays(-999)); // one-time: compliant regardless of how "expired" the date looks
            AddRecord("ZTest Expired", today.AddDays(-5));
            // ZTest Never Uploaded: deliberately no record -> missing

            await db.SaveChangesAsync();
        });

        var client = _fixture.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/compliance-matrix");
        request.Headers.Add("Cookie", $"cw_session={SessionTokens.Create(adminEmail, tenantId, "admin")}");
        var response = await client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var matrix = await response.Content.ReadFromJsonAsync<ComplianceMatrixDto>();
        matrix.Should().NotBeNull();

        var row = matrix!.Rows.Should().ContainSingle(r => r.StaffId == staffId).Subject;
        StatusFor(row, matrix, "ZTest Expiring Soon").Should().Be("expiring");
        StatusFor(row, matrix, "ZTest No Fixed Expiry").Should().Be("compliant");
        StatusFor(row, matrix, "ZTest One Time").Should().Be("compliant");
        StatusFor(row, matrix, "ZTest Expired").Should().Be("expired");
        StatusFor(row, matrix, "ZTest Never Uploaded").Should().Be("missing");
    }

    [Fact]
    public async Task InactiveStaffAreExcludedFromTheMatrix()
    {
        var tenantId = Guid.NewGuid();
        var adminEmail = $"{Guid.NewGuid():N}@example.com";
        var activeStaffId = Guid.NewGuid();

        await _fixture.SeedAsync(async db =>
        {
            db.Tenants.Add(new Tenant { Id = tenantId, Name = "Compliance Test Home 2" });
            db.Users.Add(new User { Id = Guid.NewGuid(), TenantId = tenantId, Email = adminEmail, Role = "admin" });
            db.StaffMembers.Add(new StaffMember { Id = activeStaffId, TenantId = tenantId, Name = "Active Carer", IsActive = true });
            db.StaffMembers.Add(new StaffMember { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Former Carer", IsActive = false });
            await db.SaveChangesAsync();
        });

        var client = _fixture.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/compliance-matrix");
        request.Headers.Add("Cookie", $"cw_session={SessionTokens.Create(adminEmail, tenantId, "admin")}");
        var response = await client.SendAsync(request);

        var matrix = await response.Content.ReadFromJsonAsync<ComplianceMatrixDto>();
        matrix.Should().NotBeNull();
        matrix!.Rows.Should().ContainSingle(r => r.StaffId == activeStaffId);
        matrix.Rows.Should().NotContain(r => r.StaffName == "Former Carer");
    }

    [Fact]
    public async Task ViewerRoleIsForbiddenFromTheComplianceMatrix()
    {
        var tenantId = Guid.NewGuid();
        var viewerEmail = $"{Guid.NewGuid():N}@example.com";
        await _fixture.SeedAsync(async db =>
        {
            db.Tenants.Add(new Tenant { Id = tenantId, Name = "Compliance Test Home 3" });
            db.Users.Add(new User { Id = Guid.NewGuid(), TenantId = tenantId, Email = viewerEmail, Role = "viewer" });
            await db.SaveChangesAsync();
        });

        var client = _fixture.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/compliance-matrix");
        request.Headers.Add("Cookie", $"cw_session={SessionTokens.Create(viewerEmail, tenantId, "viewer")}");
        var response = await client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    private static string StatusFor(ComplianceRowDto row, ComplianceMatrixDto matrix, string requirementName)
    {
        var reqId = matrix.RequirementTypes.Single(r => r.Name == requirementName).Id;
        return row.Cells.Single(c => c.RequirementTypeId == reqId).Status;
    }
}
