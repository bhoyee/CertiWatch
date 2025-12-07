using System.Text.Json;
using CertiWatch.Api.Domain.Entities;
using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Infrastructure.Security;
using CertiWatch.Api.Infrastructure.Services;
using CertiWatch.Contracts.Dtos;
using CertiWatch.Contracts.Enums;
using CertiWatch.Contracts.Requests;
using CertiWatch.Contracts.Responses;
using Microsoft.EntityFrameworkCore;

namespace CertiWatch.Api.Features.Records;

public static class RecordsEndpoints
{
    public static IEndpointRouteBuilder MapRecordEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/records").RequireAuthorization();
        group.MapGet(string.Empty, ListAsync);
        group.MapGet("/{id:guid}", GetAsync);
        group.MapPatch("/{id:guid}", PatchAsync);
        return group;
    }

    private static async Task<IResult> ListAsync(AppDbContext db, ITenantContextAccessor tenantAccessor, [AsParameters] PagedQuery query, CancellationToken token)
    {
        var tenantId = tenantAccessor.Current.TenantId;
        var baseQuery = db.Records.AsNoTracking().Where(r => r.TenantId == tenantId).OrderByDescending(r => r.CreatedAt);
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
}
