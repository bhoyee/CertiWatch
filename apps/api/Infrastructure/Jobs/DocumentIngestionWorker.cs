using System.Text.Json;
using CertiWatch.Api.Domain.Entities;
using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Infrastructure.Services;
using CertiWatch.Parsing;
using CertiWatch.Parsing.Rules;
using CertiWatch.Contracts.Enums;
using Microsoft.EntityFrameworkCore;

namespace CertiWatch.Api.Infrastructure.Jobs;

public sealed class DocumentIngestionWorker : BackgroundService
{
    private readonly IIngestionQueue _queue;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<DocumentIngestionWorker> _logger;
    private readonly ParsingPipeline _pipeline;

    public DocumentIngestionWorker(
        IIngestionQueue queue,
        IServiceScopeFactory scopeFactory,
        ILogger<DocumentIngestionWorker> logger,
        ParsingPipeline pipeline)
    {
        _queue = queue;
        _scopeFactory = scopeFactory;
        _logger = logger;
        _pipeline = pipeline;
    }

    private static readonly string[] DefaultUnknownTokens = { "Unknown", "Unknown Course", "Unknown Staff", "Unknown Issuer", "N/A", "-" };

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var docEvent in _queue.ReadAllAsync(stoppingToken))
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var inference = scope.ServiceProvider.GetRequiredService<IRuleInferenceService>();

                var sourceId = docEvent.SourceId == Guid.Empty ? Guid.NewGuid() : docEvent.SourceId;
                var source = await db.Sources.FirstOrDefaultAsync(s => s.Id == sourceId, stoppingToken);
                if (source is null)
                {
                    source = new Source
                    {
                        Id = sourceId,
                        TenantId = docEvent.TenantId,
                        DisplayName = "Worker Source",
                        Type = SourceType.Local,
                        ConfigJson = "{}",
                        CreatedAt = docEvent.DetectedAt
                    };
                    db.Sources.Add(source);
                }

                var sanitizedFields = SanitizeFields(docEvent.ExtractedFields);
                var parsed = _pipeline.Parse(string.Join('\n', sanitizedFields.Select(kv => $"{kv.Key}:{kv.Value}")));
                var staff = sanitizedFields.GetValueOrDefault("staff_name")
                            ?? NormalizeText(parsed.Result.StaffName, "Unknown")
                            ?? "Unknown";
                var course = sanitizedFields.GetValueOrDefault("course_name")
                             ?? NormalizeText(parsed.Result.CourseName, "Unknown Course")
                             ?? "Unknown Course";
                var issuer = sanitizedFields.GetValueOrDefault("issuer")
                             ?? NormalizeText(parsed.Result.Issuer);
                var issueDate = TryParse(sanitizedFields.GetValueOrDefault("issue_date"))
                                ?? parsed.Result.IssueDate;
                var expiryDate = TryParse(sanitizedFields.GetValueOrDefault("expiry_date"))
                                 ?? parsed.Result.ExpiryDate;
                var expiryDerived = !parsed.Result.ExpiryDate.HasValue && expiryDate.HasValue;

                if (!expiryDate.HasValue)
                {
                    var match = await inference.InferAsync(docEvent.TenantId, course, issuer, docEvent.VendorHints, issueDate, stoppingToken);
                    if (match is not null && match.ValidityMonths.HasValue && issueDate.HasValue)
                    {
                        expiryDate = issueDate.Value.AddMonths(match.ValidityMonths.Value);
                        expiryDerived = true;
                    }
                }

                // If we have already seen this file hash for the tenant, update the latest record instead of inserting a duplicate
                var existingDocument = await db.Documents
                    .Include(d => d.Records)
                    .Where(d => d.TenantId == docEvent.TenantId && d.FileHash == docEvent.FileHash)
                    .OrderByDescending(d => d.CreatedAt)
                    .FirstOrDefaultAsync(stoppingToken);

                Document document;
                if (existingDocument is null)
                {
                    document = new Document
                    {
                        Id = Guid.NewGuid(),
                        TenantId = docEvent.TenantId,
                        SourceId = sourceId,
                        FileName = docEvent.FileName,
                        FileHash = docEvent.FileHash,
                        PathOrUrl = docEvent.PathOrUrl,
                        MimeType = docEvent.MimeType,
                        ProcessingStatus = docEvent.InitialStatus,
                        CreatedAt = docEvent.DetectedAt
                    };
                    db.Documents.Add(document);
                }
                else
                {
                    document = existingDocument;
                    document.SourceId = sourceId;
                    document.FileName = docEvent.FileName;
                    document.PathOrUrl = docEvent.PathOrUrl;
                    document.MimeType = docEvent.MimeType;
                    document.ProcessingStatus = docEvent.InitialStatus;
                }

                var existingRecord = document.Records.OrderByDescending(r => r.CreatedAt).FirstOrDefault();
                if (existingRecord is null)
                {
                    var record = new Record
                    {
                        Id = Guid.NewGuid(),
                        TenantId = docEvent.TenantId,
                        DocumentId = document.Id,
                        StaffName = staff,
                        CourseName = course,
                        Issuer = issuer,
                        IssueDate = issueDate,
                        ExpiryDate = expiryDate,
                        ExpiryDerived = expiryDerived,
                        Confidence = (decimal)parsed.Result.Confidence,
                        ProcessingStatus = docEvent.InitialStatus,
                        FieldsJson = JsonSerializer.Serialize(sanitizedFields),
                        CreatedAt = docEvent.DetectedAt,
                        UpdatedAt = docEvent.DetectedAt
                    };

                    db.Records.Add(record);
                }
                else
                {
                    existingRecord.StaffName = staff ?? NormalizeText(existingRecord.StaffName, "Unknown") ?? "Unknown";
                    existingRecord.CourseName = course ?? NormalizeText(existingRecord.CourseName, "Unknown Course") ?? "Unknown Course";
                    existingRecord.Issuer = issuer ?? NormalizeText(existingRecord.Issuer) ?? existingRecord.Issuer;
                    existingRecord.IssueDate = issueDate ?? existingRecord.IssueDate;
                    if (expiryDate.HasValue)
                    {
                        existingRecord.ExpiryDate = expiryDate;
                        existingRecord.ExpiryDerived = expiryDerived;
                    }

                    existingRecord.Confidence = Math.Max(existingRecord.Confidence, (decimal)parsed.Result.Confidence);
                    existingRecord.ProcessingStatus = docEvent.InitialStatus;
                    existingRecord.FieldsJson = JsonSerializer.Serialize(sanitizedFields);
                    existingRecord.UpdatedAt = docEvent.DetectedAt;
                    _logger.LogInformation("Updated record {RecordId} for hash {FileHash} with staff={Staff} course={Course}", existingRecord.Id, docEvent.FileHash, existingRecord.StaffName, existingRecord.CourseName);
                }

                await db.SaveChangesAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to ingest document from queue");
            }
        }
    }

    private static DateOnly? TryParse(string? value)
        => DateOnly.TryParse(value, out var parsed) ? parsed : null;

    private static Dictionary<string, string> SanitizeFields(IReadOnlyDictionary<string, string> fields)
    {
        var cleaned = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var kv in fields)
        {
            var value = NormalizeText(kv.Value);
            if (value is not null)
            {
                cleaned[kv.Key] = value;
            }
        }

        return cleaned;
    }

    private static string? NormalizeText(string? value, params string[] unknownTokens)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var cleaned = value.Trim();
        cleaned = cleaned.TrimEnd(',', ';');
        cleaned = TrimQuotes(cleaned);

        cleaned = cleaned.Trim().Trim('"', '\'', '“', '”', '‘', '’');
        cleaned = cleaned.TrimEnd(',', ';').Trim();

        if (string.IsNullOrWhiteSpace(cleaned))
        {
            return null;
        }

        if (IsUnknown(cleaned, unknownTokens))
        {
            return null;
        }

        return cleaned;
    }

    private static string TrimQuotes(string text)
    {
        var quotePairs = new (char start, char end)[]
        {
            ('"', '"'),
            ('“', '”'),
            ('‘', '’'),
            ('\'', '\'')
        };

        foreach (var (start, end) in quotePairs)
        {
            if (text.Length >= 2 && text.StartsWith(start) && text.EndsWith(end))
            {
                return text[1..^1];
            }
        }

        return text;
    }

    private static bool IsUnknown(string value, params string[] unknownTokens)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return true;
        }

        var tokens = DefaultUnknownTokens.Concat(unknownTokens);
        return tokens.Any(token => value.Equals(token, StringComparison.OrdinalIgnoreCase));
    }
}
