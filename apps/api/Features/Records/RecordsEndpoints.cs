using System.Text.Json;
using CertiWatch.Api.Domain.Entities;
using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Infrastructure.Security;
using CertiWatch.Api.Infrastructure.Services;
using CertiWatch.Contracts.Dtos;
using CertiWatch.Contracts.Enums;
using CertiWatch.Contracts.Requests;
using CertiWatch.Contracts.Responses;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.IO;

namespace CertiWatch.Api.Features.Records;

public static class RecordsEndpoints
{
    public static IEndpointRouteBuilder MapRecordEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/records").RequireAuthorization();
        group.MapGet(string.Empty, ListAsync);
        group.MapGet("/review-count", ReviewCountAsync);
        group.MapGet("/{id:guid}", GetAsync);
        group.MapPatch("/{id:guid}", PatchAsync);
        group.MapDelete("/{id:guid}", DeleteAsync);
        return group;
    }

    private static async Task<IResult> ListAsync(AppDbContext db, ITenantContextAccessor tenantAccessor, [AsParameters] PagedQuery query, [FromQuery] string? status, CancellationToken token)
    {
        var tenantId = tenantAccessor.Current.TenantId;
        var baseQuery = db.Records.AsNoTracking().Where(r => r.TenantId == tenantId);

        // Filter by status if provided
        if (!string.IsNullOrWhiteSpace(status))
        {
            var normalized = status.Trim().ToLowerInvariant();
            var map = new Dictionary<string, ProcessingStatus>(StringComparer.OrdinalIgnoreCase)
            {
                ["pending"] = ProcessingStatus.Pending,
                ["ok"] = ProcessingStatus.Ok,
                ["needs review"] = ProcessingStatus.NeedsReview,
                ["needs_review"] = ProcessingStatus.NeedsReview,
                ["review"] = ProcessingStatus.NeedsReview,
                ["failed"] = ProcessingStatus.Failed
            };
            if (map.TryGetValue(normalized, out var mapped))
            {
                baseQuery = baseQuery.Where(r => r.ProcessingStatus == mapped);
            }
        }

        // Search filter
        if (!string.IsNullOrWhiteSpace(query.Filter))
        {
            var term = query.Filter.Trim().ToLower();
            baseQuery = baseQuery.Where(r =>
                (r.StaffName ?? string.Empty).ToLower().Contains(term) ||
                (r.CourseName ?? string.Empty).ToLower().Contains(term) ||
                (r.Issuer ?? string.Empty).ToLower().Contains(term));
        }

        baseQuery = ApplySort(baseQuery, query.Sort);

        var total = await baseQuery.CountAsync(token);
        var items = await baseQuery.Skip(query.Offset).Take(query.Take).ToListAsync(token);
        var dtos = items.Select(ToDto).ToList();
        return Results.Ok(new PagedResult<RecordDto>
        {
            Items = dtos,
            Page = query.Page,
            PageSize = query.PageSize,
            Total = total
        });
    }

    private static async Task<IResult> ReviewCountAsync(AppDbContext db, ITenantContextAccessor tenantAccessor, CancellationToken token)
    {
        var tenantId = tenantAccessor.Current.TenantId;
        var count = await db.Records.AsNoTracking()
            .Where(r => r.TenantId == tenantId && r.ProcessingStatus == ProcessingStatus.NeedsReview)
            .CountAsync(token);

        return Results.Ok(new { count });
    }

    private static async Task<IResult> GetAsync(Guid id, AppDbContext db, ITenantContextAccessor tenantAccessor, CancellationToken token)
    {
        var entity = await db.Records.AsNoTracking().Include(r => r.Document).FirstOrDefaultAsync(r => r.Id == id && r.TenantId == tenantAccessor.Current.TenantId, token);
        if (entity is null)
        {
            return Results.NotFound();
        }

        var reminders = await db.Reminders.AsNoTracking().Where(r => r.RecordId == id).ToListAsync(token);
        var audit = await db.AuditLogs.AsNoTracking().Where(a => a.TenantId == tenantAccessor.Current.TenantId).OrderByDescending(a => a.CreatedAt).Take(25).ToListAsync(token);

        var detail = new RecordDetailDto(
            ToDto(entity),
            new DocumentDto(entity.Document!.Id, entity.Document.TenantId, entity.Document.SourceId, entity.Document.FileName, entity.Document.PathOrUrl, entity.Document.FileHash, entity.Document.MimeType, entity.Document.ProcessingStatus, entity.Document.CreatedAt, entity.Document.ProcessedAt, entity.Document.DocumentType, entity.Document.ExtractionConfidence),
            reminders.Select(r => new ReminderDto(r.Id, r.Type, r.RecordId, r.ScheduledFor, r.SentAt)).ToList(),
            audit.Select(a => new AuditLogDto(a.Id, a.ActorId, a.Action, DeserializeMeta(a.MetaJson), a.CreatedAt)).ToList(),
            new List<string> { "approve", "fix-date", "ignore" }
        );

        return Results.Ok(detail);
    }

    private static async Task<IResult> PatchAsync(Guid id, PatchRecordRequest request, AppDbContext db, ITenantContextAccessor tenantAccessor, IDateTimeProvider clock, CancellationToken token)
    {
        var entity = await db.Records.FirstOrDefaultAsync(r => r.Id == id && r.TenantId == tenantAccessor.Current.TenantId, token);
        if (entity is null)
        {
            return Results.NotFound();
        }

        if (!string.IsNullOrWhiteSpace(request.StaffName)) entity.StaffName = request.StaffName;
        if (!string.IsNullOrWhiteSpace(request.CourseName)) entity.CourseName = request.CourseName;
        if (!string.IsNullOrWhiteSpace(request.Issuer)) entity.Issuer = request.Issuer;
        if (request.IssueDate.HasValue) entity.IssueDate = request.IssueDate;
        if (request.ExpiryDate.HasValue)
        {
            entity.ExpiryDate = request.ExpiryDate;
            entity.ExpiryDerived = false;
        }
        if (request.Confidence.HasValue) entity.Confidence = request.Confidence.Value;
        if (request.ExtractionConfidence.HasValue) entity.ExtractionConfidence = request.ExtractionConfidence.Value;

        if (request.ReviewReason is not null) entity.ReviewReason = request.ReviewReason;
        if (request.ReviewNotes is not null) entity.ReviewNotes = request.ReviewNotes;

        if (request.ProcessingStatus.HasValue)
        {
            entity.ProcessingStatus = request.ProcessingStatus.Value;
            if (entity.ProcessingStatus == ProcessingStatus.NeedsReview)
            {
                entity.ReviewedBy = null;
                entity.ReviewedAt = null;
            }
            else
            {
                entity.ReviewedBy = tenantAccessor.Current.UserId;
                entity.ReviewedAt = clock.UtcNow;
            }
        }
        else if (entity.ProcessingStatus != ProcessingStatus.NeedsReview && entity.ReviewedAt is null)
        {
            // If status is already resolved, stamp reviewer on first edit.
            entity.ReviewedBy = tenantAccessor.Current.UserId;
            entity.ReviewedAt = clock.UtcNow;
        }

        entity.UpdatedAt = clock.UtcNow;
        await db.SaveChangesAsync(token);

        db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            TenantId = entity.TenantId,
            ActorId = tenantAccessor.Current.UserId,
            Action = "record.patched",
            MetaJson = JsonSerializer.Serialize(new { id, request }),
            CreatedAt = clock.UtcNow
        });
        await db.SaveChangesAsync(token);

        return Results.Ok(ToDto(entity));
    }

    private static async Task<IResult> DeleteAsync(Guid id, AppDbContext db, ITenantContextAccessor tenantAccessor, IDateTimeProvider clock, CancellationToken token)
    {
        var entity = await db.Records.Include(r => r.Document).FirstOrDefaultAsync(r => r.Id == id && r.TenantId == tenantAccessor.Current.TenantId, token);
        if (entity is null)
        {
            return Results.NotFound();
        }

        var reminders = db.Reminders.Where(r => r.RecordId == id);
        db.Reminders.RemoveRange(reminders);

        var document = entity.Document;

        db.Records.Remove(entity);

        if (document is not null)
        {
            var hasOtherRecords = await db.Records.AsNoTracking()
                .AnyAsync(r => r.DocumentId == document.Id && r.Id != entity.Id && r.TenantId == entity.TenantId, token);
            if (!hasOtherRecords)
            {
                db.Documents.Remove(document);
                if (!string.IsNullOrWhiteSpace(document.PathOrUrl) && File.Exists(document.PathOrUrl))
                {
                    File.Delete(document.PathOrUrl);
                }
            }
        }

        db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            TenantId = entity.TenantId,
            ActorId = tenantAccessor.Current.UserId,
            Action = "record.deleted",
            MetaJson = JsonSerializer.Serialize(new { id }),
            CreatedAt = clock.UtcNow
        });

        await db.SaveChangesAsync(token);
        return Results.NoContent();
    }

    internal static RecordDto ToDtoForReport(Record record) => ToDto(record);

    private static RecordDto ToDto(Record record)
    {
        var fields = DeserializeFields(record.FieldsJson);
        var staff = NormalizeText(record.StaffName) ?? "Unknown";
        var course = NormalizeText(record.CourseName) ?? "Unknown Course";
        var issuer = NormalizeText(record.Issuer);
        return new RecordDto(
            record.Id,
            record.TenantId,
            record.DocumentId,
            staff,
            course,
            issuer,
            record.IssueDate,
            record.ExpiryDate,
            record.ExpiryDerived,
            record.Confidence,
            record.Confidence switch
            {
                >= 0.85m => RecordConfidenceBand.High,
                >= 0.65m => RecordConfidenceBand.Medium,
                >= 0.4m => RecordConfidenceBand.Low,
                _ => RecordConfidenceBand.Unknown
            },
            record.ProcessingStatus,
            record.ReviewReason,
            record.ReviewNotes,
            record.ReviewedBy,
            record.ReviewedAt,
            fields,
            record.CreatedAt,
            record.UpdatedAt,
            record.DocumentType,
            record.ExtractionConfidence);
    }

    private static string? NormalizeText(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var cleaned = value.Trim();
        cleaned = cleaned.TrimEnd(',', ';');
        if (cleaned.Length >= 2 && cleaned.StartsWith("\"") && cleaned.EndsWith("\""))
        {
            cleaned = cleaned[1..^1];
        }

        cleaned = cleaned.Trim().Trim('"', '\'');
        cleaned = cleaned.TrimEnd(',', ';').Trim();

        return string.IsNullOrWhiteSpace(cleaned) ? null : cleaned;
    }

    private static IReadOnlyDictionary<string, string> DeserializeFields(string json)
        => string.IsNullOrWhiteSpace(json)
            ? new Dictionary<string, string>()
            : JsonSerializer.Deserialize<Dictionary<string, string>>(json) ?? new Dictionary<string, string>();

    private static IReadOnlyDictionary<string, object> DeserializeMeta(string json)
        => string.IsNullOrWhiteSpace(json)
            ? new Dictionary<string, object>()
            : JsonSerializer.Deserialize<Dictionary<string, object>>(json) ?? new Dictionary<string, object>();

    private static IQueryable<Record> ApplySort(IQueryable<Record> query, string? sort)
    {
        var sortField = "created_at";
        var sortDir = "desc";

        if (!string.IsNullOrWhiteSpace(sort) && sort.Contains(':'))
        {
            var parts = sort.Split(':', 2, StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length == 2)
            {
                sortField = parts[0].ToLowerInvariant();
                sortDir = parts[1].ToLowerInvariant();
            }
        }

        // Use typed property switches to keep IQueryable and avoid client-side evaluation.
        return sortField switch
        {
            "staff" or "staffname" => sortDir == "asc"
                ? query.OrderBy(r => r.StaffName)
                : query.OrderByDescending(r => r.StaffName),
            "course" or "coursename" => sortDir == "asc"
                ? query.OrderBy(r => r.CourseName)
                : query.OrderByDescending(r => r.CourseName),
            "issuer" => sortDir == "asc"
                ? query.OrderBy(r => r.Issuer)
                : query.OrderByDescending(r => r.Issuer),
            "issue" or "issuedate" => sortDir == "asc"
                ? query.OrderBy(r => r.IssueDate)
                : query.OrderByDescending(r => r.IssueDate),
            "expiry" or "expirydate" => sortDir == "asc"
                ? query.OrderBy(r => r.ExpiryDate)
                : query.OrderByDescending(r => r.ExpiryDate),
            "confidence" => sortDir == "asc"
                ? query.OrderBy(r => r.Confidence)
                : query.OrderByDescending(r => r.Confidence),
            "status" or "processingstatus" => sortDir == "asc"
                ? query.OrderBy(r => r.ProcessingStatus)
                : query.OrderByDescending(r => r.ProcessingStatus),
            "extractionconfidence" => sortDir == "asc"
                ? query.OrderBy(r => r.ExtractionConfidence)
                : query.OrderByDescending(r => r.ExtractionConfidence),
            _ => sortDir == "asc"
                ? query.OrderBy(r => r.CreatedAt)
                : query.OrderByDescending(r => r.CreatedAt)
        };
    }
}
