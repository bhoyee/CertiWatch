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
using System.Text;

namespace CertiWatch.Api.Features.Records;

public static class RecordsEndpoints
{
    public static IEndpointRouteBuilder MapRecordEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/records").RequireAuthorization();
        group.MapGet(string.Empty, ListAsync);
        group.MapGet("/export.csv", ExportCsvAsync);
        group.MapGet("/export.pdf", ExportPdfAsync);
        group.MapGet("/review-count", ReviewCountAsync);
        group.MapGet("/{id:guid}", GetAsync);
        group.MapPatch("/{id:guid}", PatchAsync);
        group.MapDelete("/{id:guid}", DeleteAsync);
        return group;
    }

    private static async Task<IResult> ListAsync(AppDbContext db, ITenantContextAccessor tenantAccessor, [AsParameters] PagedQuery query, [FromQuery] string? status, CancellationToken token)
    {
        var scope = await RecordVisibility.GetScopeAsync(db, tenantAccessor, token);
        var baseQuery = BuildBaseQuery(db, tenantAccessor, query.Filter, status, scope);
        // For managers/viewers we have already moved to in-memory filtering.
        var sorted = ApplySort(baseQuery, query.Sort).ToList();

        var total = sorted.Count;
        var items = sorted.Skip(query.Offset).Take(query.Take).ToList();
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
        var scope = await RecordVisibility.GetScopeAsync(db, tenantAccessor, token);
        var baseQuery = db.Records.AsNoTracking().Where(r => r.TenantId == tenantId);
        var scoped = RecordVisibility.ApplyScope(baseQuery, scope).AsEnumerable();
        var count = scoped.Count(r => r.ProcessingStatus == ProcessingStatus.NeedsReview);

        return Results.Ok(new { count });
    }

    private static async Task<IResult> GetAsync(Guid id, AppDbContext db, ITenantContextAccessor tenantAccessor, CancellationToken token)
    {
        var scope = await RecordVisibility.GetScopeAsync(db, tenantAccessor, token);
        var baseQuery = db.Records.AsNoTracking()
            .Include(r => r.Document)
            .Where(r => r.TenantId == tenantAccessor.Current.TenantId);
        var scoped = RecordVisibility.ApplyScope(baseQuery, scope).AsEnumerable();
        var entity = scoped.FirstOrDefault(r => r.Id == id);
        if (entity is null)
        {
            return Results.NotFound();
        }

        if (entity.Document is null)
        {
            // If the document was deleted or not loaded, return 404 for safety.
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
        var scope = await RecordVisibility.GetScopeAsync(db, tenantAccessor, token);
        var isAdmin = RecordVisibility.IsAdmin(tenantAccessor);

        var entity = await db.Records.FirstOrDefaultAsync(r => r.Id == id && r.TenantId == tenantAccessor.Current.TenantId, token);
        if (entity is null)
        {
            return Results.NotFound();
        }

        if (!isAdmin)
        {
            // Managers can only edit records they or their viewers created.
            var allowed = scope?.AllowedCreatorIds?.Contains(entity.CreatedByUserId ?? Guid.Empty) == true;
            if (!(RecordVisibility.IsManager(tenantAccessor) && allowed))
            {
                return Results.Forbid();
            }
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
        var scope = await RecordVisibility.GetScopeAsync(db, tenantAccessor, token);
        var isAdmin = RecordVisibility.IsAdmin(tenantAccessor);

        var entity = await db.Records.Include(r => r.Document).FirstOrDefaultAsync(r => r.Id == id && r.TenantId == tenantAccessor.Current.TenantId, token);
        if (entity is null)
        {
            return Results.NotFound();
        }

        if (!isAdmin)
        {
            var allowed = scope?.AllowedCreatorIds?.Contains(entity.CreatedByUserId ?? Guid.Empty) == true;
            if (!(RecordVisibility.IsManager(tenantAccessor) && allowed))
            {
                return Results.Forbid();
            }
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

    private static async Task<IResult> ExportCsvAsync(AppDbContext db, ITenantContextAccessor tenantAccessor, [AsParameters] PagedQuery query, [FromQuery] string? status, CancellationToken token)
    {
        var scope = await RecordVisibility.GetScopeAsync(db, tenantAccessor, token);
        var baseQuery = BuildBaseQuery(db, tenantAccessor, query.Filter, status, scope);
        var rows = baseQuery
            .OrderBy(r => r.CreatedAt)
            .Select(r => new
            {
                r.StaffName,
                r.CourseName,
                r.Issuer,
                r.IssueDate,
                r.ExpiryDate,
                r.ProcessingStatus,
                r.Confidence
            })
            .ToList();

        var csv = new StringBuilder();
        csv.AppendLine("Staff,Course,Issuer,Issue,Expiry,Status,Confidence");
        foreach (var row in rows)
        {
            var staff = Escape(row.StaffName);
            var course = Escape(row.CourseName);
            var issuer = Escape(row.Issuer);
            var issue = row.IssueDate?.ToString("yyyy-MM-dd") ?? string.Empty;
            var expiry = row.ExpiryDate?.ToString("yyyy-MM-dd") ?? string.Empty;
            var statusLabel = StatusLabelFromEnum(row.ProcessingStatus);
            var confidence = row.Confidence != 0 ? $"{Math.Round(row.Confidence * 100, 0):0}%" : string.Empty;
            csv.AppendLine($"{staff},{course},{issuer},{issue},{expiry},{statusLabel},{confidence}");
        }

        var bytes = Encoding.UTF8.GetBytes(csv.ToString());
        return Results.File(bytes, "text/csv", "records-export.csv");
    }

    private static async Task<IResult> ExportPdfAsync(AppDbContext db, ITenantContextAccessor tenantAccessor, [AsParameters] PagedQuery query, [FromQuery] string? status, CancellationToken token)
    {
        var scope = await RecordVisibility.GetScopeAsync(db, tenantAccessor, token);
        var baseQuery = BuildBaseQuery(db, tenantAccessor, query.Filter, status, scope);
        var rows = baseQuery
            .OrderBy(r => r.CreatedAt)
            .Take(500)
            .ToList();

        var sb = new StringBuilder();
        sb.AppendLine("CertiWatch Records Export");
        sb.AppendLine($"Generated: {DateTime.UtcNow:O}");
        sb.AppendLine();
        foreach (var r in rows)
        {
            sb.AppendLine($"{r.StaffName} | {r.CourseName} | {r.Issuer ?? "--"} | Issue: {r.IssueDate:yyyy-MM-dd} | Expiry: {r.ExpiryDate:yyyy-MM-dd} | Status: {StatusLabelFromEnum(r.ProcessingStatus)} | Confidence: {FormatPercent(r.Confidence)}");
        }

        var pdfBytes = BuildMinimalPdf(sb.ToString());
        return Results.File(pdfBytes, "application/pdf", "records-export.pdf");
    }

    private static IQueryable<Record> BuildBaseQuery(AppDbContext db, ITenantContextAccessor tenantAccessor, string? filter, string? status, RecordVisibility.Scope? scope)
    {
        var tenantId = tenantAccessor.Current.TenantId;
        var baseQuery = db.Records.AsNoTracking().Where(r => r.TenantId == tenantId);

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

        if (!string.IsNullOrWhiteSpace(filter))
        {
            var term = filter.Trim().ToLower();
            baseQuery = baseQuery.Where(r =>
                (r.StaffName ?? string.Empty).ToLower().Contains(term) ||
                (r.CourseName ?? string.Empty).ToLower().Contains(term) ||
                (r.Issuer ?? string.Empty).ToLower().Contains(term));
        }

        if (scope is not null)
        {
            // For scoped users (manager/viewer) we materialize client-side to avoid EF translation issues.
            return RecordVisibility.ApplyScope(baseQuery, scope).AsEnumerable().AsQueryable();
        }

        return baseQuery;
    }

    private static string Escape(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;
        var cleaned = value.Replace("\"", "\"\"");
        // A field starting with =, +, -, or @ executes as a formula when the export is opened
        // in Excel/Sheets - a leading apostrophe is the standard mitigation (forces text, and
        // spreadsheet apps hide it on display).
        if ("=+-@".IndexOf(cleaned[0]) >= 0)
        {
            cleaned = "'" + cleaned;
        }
        return cleaned.Contains(',') ? $"\"{cleaned}\"" : cleaned;
    }

    private static string StatusLabelFromEnum(ProcessingStatus status) => status switch
    {
        ProcessingStatus.Pending => "pending",
        ProcessingStatus.Ok => "ok",
        ProcessingStatus.NeedsReview => "needs review",
        ProcessingStatus.Failed => "failed",
        _ => status.ToString()
    };

    private static string FormatPercent(decimal? value)
    {
        if (value is null) return "n/a";
        return $"{Math.Round(value.Value * 100, 0):0}%";
    }

    private static byte[] BuildMinimalPdf(string textContent)
    {
        // Minimal PDF: single page with the text content.
        var content = textContent.Replace("(", "\\(").Replace(")", "\\(").Replace("\\", "\\\\");
        var sb = new StringBuilder();
        sb.AppendLine("%PDF-1.4");
        sb.AppendLine("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj");
        sb.AppendLine("2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj");
        sb.AppendLine("3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << >> >> endobj");
        var stream = $"BT /F1 12 Tf 50 750 Td ({content}) Tj ET";
        sb.AppendLine($"4 0 obj << /Length {stream.Length} >> stream");
        sb.AppendLine(stream);
        sb.AppendLine("endstream endobj");
        sb.AppendLine("5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj");
        sb.AppendLine("xref");
        sb.AppendLine("0 6");
        sb.AppendLine("0000000000 65535 f ");
        sb.AppendLine("trailer << /Root 1 0 R /Size 6 >>");
        sb.AppendLine("startxref");
        sb.AppendLine("0");
        sb.AppendLine("%%EOF");
        return Encoding.UTF8.GetBytes(sb.ToString());
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
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return new Dictionary<string, string>();
        }

        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, string>>(json) ?? new Dictionary<string, string>();
        }
        catch
        {
            // If stored text is not valid JSON (e.g., legacy rows), fall back to an empty map to avoid crashes.
            return new Dictionary<string, string>();
        }
    }

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
