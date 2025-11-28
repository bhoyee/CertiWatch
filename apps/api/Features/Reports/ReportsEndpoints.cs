using CertiWatch.Api.Infrastructure.Emails;
using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Infrastructure.Security;
using CertiWatch.Contracts.Dtos;
using CertiWatch.Contracts.Responses;
using Microsoft.EntityFrameworkCore;
using CertiWatch.Contracts.Enums;

namespace CertiWatch.Api.Features.Reports;

public static class ReportsEndpoints
{
    public static IEndpointRouteBuilder MapReportEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/reports").RequireAuthorization();
        group.MapGet("/digest-preview", DigestPreviewAsync);
        group.MapPost("/export-pdf", ExportPdfAsync);
        group.MapGet("/analytics", AnalyticsAsync);
        return group;
    }

    private static async Task<IResult> DigestPreviewAsync(AppDbContext db, ITenantContextAccessor accessor, IEmailTemplateRenderer renderer, CancellationToken token)
    {
        var tenantId = accessor.Current.TenantId;
        var tenant = await db.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == tenantId, token);
        var records = await db.Records.AsNoTracking().Where(r => r.TenantId == tenantId).ToListAsync(token);
        var digest = new TenantDigestDto(
            tenantId,
            tenant?.Name ?? "Tenant",
            records.Take(5).Select(Records.RecordsEndpoints.ToDtoForReport).ToList(),
            records.Where(r => r.ExpiryDate != null && r.ExpiryDate <= DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30))).Select(Records.RecordsEndpoints.ToDtoForReport).ToList(),
            records.Where(r => r.ExpiryDate != null && r.ExpiryDate < DateOnly.FromDateTime(DateTime.UtcNow)).Select(Records.RecordsEndpoints.ToDtoForReport).ToList(),
            records.Where(r => r.Confidence < 0.6m).Select(Records.RecordsEndpoints.ToDtoForReport).ToList());

        var html = renderer.RenderDigest(digest);
        return Results.Ok(new DigestPreviewResponse(digest, html));
    }

    private static IResult ExportPdfAsync()
    {
        var fake = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes("CertiWatch Report"));
        return Results.Ok(new { fileName = $"certiwatch-report-{DateTime.UtcNow:yyyyMMdd}.pdf", content = fake });
    }

    private static async Task<IResult> AnalyticsAsync(AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        var tenantId = accessor.Current.TenantId;
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var soon = today.AddDays(30);

        var records = await db.Records.AsNoTracking().Where(r => r.TenantId == tenantId).ToListAsync(token);
        var expiringSoon = records.Where(r => r.ExpiryDate != null && r.ExpiryDate >= today && r.ExpiryDate <= soon).ToList();
        var expired = records.Where(r => r.ExpiryDate != null && r.ExpiryDate < today).ToList();
        var lowConfidence = records.Where(r => r.Confidence < 0.6m).ToList();

        var statusCounts = records
            .GroupBy(r => r.ProcessingStatus.ToString())
            .ToDictionary(g => g.Key, g => g.Count());

        var dto = new AnalyticsOverviewDto(
            TotalRecords: records.Count,
            ExpiringSoon: expiringSoon.Count,
            Expired: expired.Count,
            LowConfidence: lowConfidence.Count,
            Devices: await db.Devices.CountAsync(d => d.TenantId == tenantId, token),
            Sources: await db.Sources.CountAsync(s => s.TenantId == tenantId, token),
            StatusCounts: statusCounts,
            ExpiringSoonList: expiringSoon.OrderBy(r => r.ExpiryDate).Take(10).Select(Records.RecordsEndpoints.ToDtoForReport).ToList());

        return Results.Ok(dto);
    }
}
