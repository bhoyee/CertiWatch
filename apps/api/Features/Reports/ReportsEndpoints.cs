using CertiWatch.Api.Infrastructure.Emails;
using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Infrastructure.Security;
using CertiWatch.Contracts.Dtos;
using CertiWatch.Contracts.Responses;
using Microsoft.EntityFrameworkCore;

namespace CertiWatch.Api.Features.Reports;

public static class ReportsEndpoints
{
    public static IEndpointRouteBuilder MapReportEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/reports").RequireAuthorization();
        group.MapGet("/digest-preview", DigestPreviewAsync);
        group.MapPost("/export-pdf", ExportPdfAsync);
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
}
