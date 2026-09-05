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
        group.MapGet("/analytics", AnalyticsAsync);
        return group;
    }

    private static async Task<IResult> DigestPreviewAsync(AppDbContext db, ITenantContextAccessor accessor, IEmailTemplateRenderer renderer, CancellationToken token)
    {
        var tenantId = accessor.Current.TenantId;
        var tenant = await db.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == tenantId, token);
        var scope = await RecordVisibility.GetScopeAsync(db, accessor, token);
        var recordQuery = db.Records.AsNoTracking().Where(r => r.TenantId == tenantId);
        recordQuery = RecordVisibility.ApplyScope(recordQuery, scope);
        var records = recordQuery
            .AsEnumerable()
            .Select(r => new SimpleRecord(
                r.Id,
                r.TenantId,
                r.DocumentId,
                r.StaffName,
                r.CourseName,
                r.Issuer,
                r.IssueDate,
                r.ExpiryDate,
                r.ExpiryDerived,
                r.Confidence,
                r.ExtractionConfidence,
                r.ProcessingStatus,
                r.ReviewReason,
                r.ReviewNotes,
                r.ReviewedBy,
                r.ReviewedAt,
                r.CreatedAt,
                r.UpdatedAt,
                r.DocumentType))
            .ToList();
        var recordDtos = records.Select(ToLightDto).ToList();
        var digest = new TenantDigestDto(
            tenantId,
            tenant?.Name ?? "Tenant",
            recordDtos.Take(5).ToList(),
            recordDtos.Where(r => r.ExpiryDate != null && r.ExpiryDate <= DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30))).ToList(),
            recordDtos.Where(r => r.ExpiryDate != null && r.ExpiryDate < DateOnly.FromDateTime(DateTime.UtcNow)).ToList(),
            recordDtos.Where(r => r.Confidence < 0.6m).ToList());

        var html = renderer.RenderDigest(digest);
        return Results.Ok(new DigestPreviewResponse(digest, html));
    }

    private static async Task<IResult> AnalyticsAsync(AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        var tenantId = accessor.Current.TenantId;
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var soon = today.AddDays(30);

        var scope = await RecordVisibility.GetScopeAsync(db, accessor, token);
        var recordQuery = db.Records.AsNoTracking().Where(r => r.TenantId == tenantId);
        recordQuery = RecordVisibility.ApplyScope(recordQuery, scope);
        var records = recordQuery
            .AsEnumerable()
            .Select(r => new SimpleRecord(
                r.Id,
                r.TenantId,
                r.DocumentId,
                r.StaffName,
                r.CourseName,
                r.Issuer,
                r.IssueDate,
                r.ExpiryDate,
                r.ExpiryDerived,
                r.Confidence,
                r.ExtractionConfidence,
                r.ProcessingStatus,
                r.ReviewReason,
                r.ReviewNotes,
                r.ReviewedBy,
                r.ReviewedAt,
                r.CreatedAt,
                r.UpdatedAt,
                r.DocumentType))
            .ToList();
        var recordDtos = records.Select(ToLightDto).ToList();
        var okRecords = recordDtos.Where(r => r.ProcessingStatus == ProcessingStatus.Ok).ToList();
        var expiringSoon = recordDtos.Where(r => r.ExpiryDate != null && r.ExpiryDate >= today && r.ExpiryDate <= soon).ToList();
        var expired = recordDtos.Where(r => r.ExpiryDate != null && r.ExpiryDate < today).ToList();
        var lowConfidence = recordDtos.Where(r => r.Confidence < 0.6m).ToList();

        var statusCounts = recordDtos
            .GroupBy(r => r.ProcessingStatus.ToString())
            .ToDictionary(g => g.Key, g => g.Count());

        // okRecordCreatedDates drives both the trend line and the week-over-week delta, so the
        // sparkline under "Total records" and the number beside it always tell the same story.
        var okRecordSet = records.Where(r => r.ProcessingStatus == ProcessingStatus.Ok).ToList();
        var trendStart = today.AddDays(-29);
        var recordsTrend = Enumerable.Range(0, 30)
            .Select(i => trendStart.AddDays(i))
            .Select(d => new DayCountDto(d, okRecordSet.Count(r => DateOnly.FromDateTime(r.CreatedAt) == d)))
            .ToList();

        var nowUtc = DateTime.UtcNow;
        var newThisWeek = okRecordSet.Count(r => r.CreatedAt >= nowUtc.AddDays(-7));
        var newLastWeek = okRecordSet.Count(r => r.CreatedAt >= nowUtc.AddDays(-14) && r.CreatedAt < nowUtc.AddDays(-7));

        var forwardLooking = recordDtos.Where(r => r.ExpiryDate != null && r.ExpiryDate >= today).ToList();
        var expiryBuckets = new ExpiryBucketsDto(
            Next7: forwardLooking.Count(r => r.ExpiryDate <= today.AddDays(7)),
            Next30: forwardLooking.Count(r => r.ExpiryDate > today.AddDays(7) && r.ExpiryDate <= today.AddDays(30)),
            Next60: forwardLooking.Count(r => r.ExpiryDate > today.AddDays(30) && r.ExpiryDate <= today.AddDays(60)),
            Next90Plus: forwardLooking.Count(r => r.ExpiryDate > today.AddDays(60)));

        var isViewer = RecordVisibility.IsViewer(accessor);
        var dto = new AnalyticsOverviewDto(
            TotalRecords: okRecords.Count,
            ExpiringSoon: expiringSoon.Count,
            Expired: expired.Count,
            LowConfidence: lowConfidence.Count,
            Devices: isViewer ? 0 : await db.Devices.CountAsync(d => d.TenantId == tenantId, token),
            Sources: isViewer ? 0 : await db.Sources.CountAsync(s => s.TenantId == tenantId, token),
            StatusCounts: statusCounts,
            ExpiringSoonList: expiringSoon.OrderBy(r => r.ExpiryDate).Take(10).ToList(),
            RecordsTrend: recordsTrend,
            ExpiryBuckets: expiryBuckets,
            NewThisWeek: newThisWeek,
            NewLastWeek: newLastWeek);

        return Results.Ok(dto);
    }

    private sealed record SimpleRecord(
        Guid Id,
        Guid TenantId,
        Guid DocumentId,
        string StaffName,
        string CourseName,
        string? Issuer,
        DateOnly? IssueDate,
        DateOnly? ExpiryDate,
        bool ExpiryDerived,
        decimal Confidence,
        decimal? ExtractionConfidence,
        ProcessingStatus ProcessingStatus,
        string? ReviewReason,
        string? ReviewNotes,
        Guid? ReviewedBy,
        DateTime? ReviewedAt,
        DateTime CreatedAt,
        DateTime UpdatedAt,
        string? DocumentType);

    private static RecordDto ToLightDto(SimpleRecord r)
    {
        string? Normalize(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return null;
            var cleaned = value.Trim().Trim('"', '\'', ',', ';').Trim();
            return string.IsNullOrWhiteSpace(cleaned) ? null : cleaned;
        }

        var band = r.Confidence switch
        {
            >= 0.85m => CertiWatch.Contracts.Enums.RecordConfidenceBand.High,
            >= 0.65m => CertiWatch.Contracts.Enums.RecordConfidenceBand.Medium,
            >= 0.4m => CertiWatch.Contracts.Enums.RecordConfidenceBand.Low,
            _ => CertiWatch.Contracts.Enums.RecordConfidenceBand.Unknown
        };

        return new RecordDto(
            r.Id,
            r.TenantId,
            r.DocumentId,
            Normalize(r.StaffName) ?? "Unknown",
            Normalize(r.CourseName) ?? "Unknown Requirement",
            Normalize(r.Issuer),
            r.IssueDate,
            r.ExpiryDate,
            r.ExpiryDerived,
            r.Confidence,
            band,
            r.ProcessingStatus,
            r.ReviewReason,
            r.ReviewNotes,
            r.ReviewedBy,
            r.ReviewedAt,
            new Dictionary<string, string>(),
            r.CreatedAt,
            r.UpdatedAt,
            r.DocumentType,
            r.ExtractionConfidence);
    }
}
