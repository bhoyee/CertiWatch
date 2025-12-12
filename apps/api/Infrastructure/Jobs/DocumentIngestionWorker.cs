using System.Text.Json;
using CertiWatch.Api.Domain.Entities;
using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Infrastructure.Services;
using CertiWatch.Parsing;
using CertiWatch.Parsing.Rules;
using CertiWatch.Contracts.Enums;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

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

                var documentType = docEvent.DocumentType ?? "generic_certificate";
                var extractionConfidence = docEvent.ExtractionConfidence;
                var reviewHints = docEvent.VendorHints.Where(h => h.StartsWith("needs_review", StringComparison.OrdinalIgnoreCase)).ToList();
                var reviewReason = reviewHints.Count > 0 ? string.Join(";", reviewHints) : null;
                var processingStatus = reviewHints.Count > 0 ? ProcessingStatus.NeedsReview : docEvent.InitialStatus;

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
                var recordConfidence = extractionConfidence ?? (decimal)parsed.Result.Confidence;

                _logger.LogInformation("Ingesting file hash {FileHash} with fields staff={Staff} course={Course} issuer={Issuer}", docEvent.FileHash, staff, course, issuer);

                if (!expiryDate.HasValue)
                {
                    var match = await inference.InferAsync(docEvent.TenantId, course, issuer, docEvent.VendorHints, issueDate, stoppingToken);
                    if (match is not null && match.ValidityMonths.HasValue && issueDate.HasValue)
                    {
                        expiryDate = issueDate.Value.AddMonths(match.ValidityMonths.Value);
                        expiryDerived = true;
                    }
                }

                // --- CRITICAL COURSE VALIDATION LOGIC START ---
                var isUnknownCourseName = IsUnknown(course);
                var courseAllowed = false;

                if (!isUnknownCourseName)
                {
                    courseAllowed = await IsCourseAllowedAsync(db, docEvent.TenantId, course, issuer, docEvent.VendorHints, stoppingToken);
                }
                
                _logger.LogInformation("Course validation for '{Course}' (Unknown={IsUnknown}, Allowed={IsAllowed})", course, isUnknownCourseName, courseAllowed);


                // Safeguard: If the course is truly unknown (null/empty/token) OR not explicitly allowed by a rule, force review.
                if (isUnknownCourseName || !courseAllowed)
                {
                    var ruleHint = "needs_review:unknown_course";
                    if (!reviewHints.Contains(ruleHint))
                    {
                        reviewHints.Add(ruleHint);
                    }
                    reviewReason = string.Join(";", reviewHints);
                    processingStatus = ProcessingStatus.NeedsReview; // Force NeedsReview here
                }
                // --- CRITICAL COURSE VALIDATION LOGIC END ---

                // Detect duplicates by staff + course + issue date to avoid re-uploaded certs
                var normalizedStaffKey = NormalizeKey(staff);
                var normalizedCourseKey = NormalizeKey(course);
                var duplicateRecord = false;
                if (issueDate.HasValue && normalizedStaffKey is not null && normalizedCourseKey is not null)
                {
                    var candidates = await db.Records
                        .AsNoTracking()
                        .Where(r => r.TenantId == docEvent.TenantId && r.IssueDate == issueDate.Value)
                        .Select(r => new { r.StaffName, r.CourseName })
                        .ToListAsync(stoppingToken);

                    duplicateRecord = candidates.Any(r =>
                        NormalizeKey(r.StaffName) == normalizedStaffKey &&
                        NormalizeKey(r.CourseName) == normalizedCourseKey);
                }

                if (duplicateRecord)
                {
                    var dupHint = "needs_review:duplicate_record";
                    if (!reviewHints.Contains(dupHint))
                    {
                        reviewHints.Add(dupHint);
                    }
                    reviewReason = string.Join(";", reviewHints);
                    processingStatus = ProcessingStatus.NeedsReview;
                    _logger.LogInformation("Duplicate detected (staff/course/date) for tenant {TenantId}: staff={Staff} course={Course} issue={IssueDate}", docEvent.TenantId, staff, course, issueDate);
                }


                // If we have already seen this file hash for the tenant, update the latest record instead of inserting a duplicate
                var existingRecord = await db.Records
                    .Include(r => r.Document)
                    .Where(r => r.TenantId == docEvent.TenantId && r.Document!.FileHash == docEvent.FileHash)
                    .OrderByDescending(r => r.CreatedAt)
                    .FirstOrDefaultAsync(stoppingToken);

                if (existingRecord is null)
                {
                    var document = new Document
                    {
                        Id = Guid.NewGuid(),
                        TenantId = docEvent.TenantId,
                        SourceId = sourceId,
                        FileName = docEvent.FileName,
                        FileHash = docEvent.FileHash,
                        PathOrUrl = docEvent.PathOrUrl,
                        MimeType = docEvent.MimeType,
                        DocumentType = documentType,
                        ExtractionConfidence = extractionConfidence,
                        ProcessingStatus = processingStatus,
                        CreatedAt = docEvent.DetectedAt
                    };
                    db.Documents.Add(document);

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
                        DocumentType = documentType,
                        ExtractionConfidence = extractionConfidence,
                        Confidence = recordConfidence,
                        ProcessingStatus = processingStatus,
                        ReviewReason = reviewReason,
                        ReviewNotes = null,
                        ReviewedAt = null,
                        ReviewedBy = null,
                        FieldsJson = JsonSerializer.Serialize(sanitizedFields),
                        CreatedAt = docEvent.DetectedAt,
                        UpdatedAt = docEvent.DetectedAt
                    };

                    db.Records.Add(record);
                }
                else
                {
                    var document = existingRecord.Document!;
                    document.SourceId = sourceId;
                    document.FileName = docEvent.FileName;
                    document.PathOrUrl = docEvent.PathOrUrl;
                    document.MimeType = docEvent.MimeType;
                    document.DocumentType = documentType;
                    document.ExtractionConfidence = extractionConfidence ?? document.ExtractionConfidence;
                    document.ProcessingStatus = processingStatus; // Use updated status

                    existingRecord.StaffName = staff ?? NormalizeText(existingRecord.StaffName, "Unknown") ?? "Unknown";
                    existingRecord.CourseName = course ?? NormalizeText(existingRecord.CourseName, "Unknown Course") ?? "Unknown Course";
                    existingRecord.Issuer = issuer ?? NormalizeText(existingRecord.Issuer) ?? existingRecord.Issuer;
                    existingRecord.IssueDate = issueDate ?? existingRecord.IssueDate;
                    if (expiryDate.HasValue)
                    {
                        existingRecord.ExpiryDate = expiryDate;
                        existingRecord.ExpiryDerived = expiryDerived;
                    }

                    existingRecord.DocumentType = documentType;
                    existingRecord.ExtractionConfidence = extractionConfidence ?? existingRecord.ExtractionConfidence;
                    existingRecord.Confidence = Math.Max(existingRecord.Confidence, recordConfidence);

                    // Auto-clear NeedsReview if a subsequent high-confidence pass succeeds without review hints.
                    var shouldAutoClear = existingRecord.ProcessingStatus == ProcessingStatus.NeedsReview
                                             && processingStatus != ProcessingStatus.NeedsReview
                                             && existingRecord.Confidence >= 0.90m;
                    if (shouldAutoClear)
                    {
                        processingStatus = ProcessingStatus.Ok; // <--- The only place status is potentially cleared.
                    }

                    // Apply the final processing status to the record
                    existingRecord.ProcessingStatus = processingStatus; 
                    
                    if (processingStatus == ProcessingStatus.NeedsReview)
                    {
                        existingRecord.ReviewReason = reviewReason;
                        existingRecord.ReviewNotes = null;
                        existingRecord.ReviewedBy = null;
                        existingRecord.ReviewedAt = null;
                    }
                    else
                    {
                        // Clear review fields if status is OK
                        existingRecord.ReviewReason = null; 
                        existingRecord.ReviewNotes = null;
                        existingRecord.ReviewedBy = null;
                        existingRecord.ReviewedAt = null;
                    }
                    existingRecord.FieldsJson = JsonSerializer.Serialize(sanitizedFields);
                    existingRecord.UpdatedAt = docEvent.DetectedAt;
                    _logger.LogInformation("Updated record {RecordId} for hash {FileHash} with staff={Staff} course={Course}, New Status: {Status}", existingRecord.Id, docEvent.FileHash, existingRecord.StaffName, existingRecord.CourseName, processingStatus);
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

    private static async Task<bool> IsCourseAllowedAsync(
        AppDbContext db,
        Guid tenantId,
        string? courseName,
        string? issuer,
        IEnumerable<string>? tags,
        CancellationToken token)
    {
        var normalizedCourse = NormalizeKey(courseName);
        var normalizedIssuer = NormalizeKey(issuer);
        var tagSet = new HashSet<string>((tags ?? Enumerable.Empty<string>()).Select(NormalizeKey).Where(v => v is not null)!);

        var rules = await db.CourseRules
            .AsNoTracking()
            .Where(r => r.TenantId == null || r.TenantId == tenantId)
            .ToListAsync(token);

        foreach (var rule in rules)
        {
            var courseMatched = false;

            // Exact match on course
            if (!string.IsNullOrWhiteSpace(rule.CourseName))
            {
                var ruleCourse = NormalizeKey(rule.CourseName);
                if (ruleCourse == normalizedCourse)
                {
                    courseMatched = true;
                }
            }

            // Regex match on course
            if (!courseMatched &&
                !string.IsNullOrWhiteSpace(rule.MatchRegex) &&
                !string.IsNullOrWhiteSpace(courseName) &&
                Regex.IsMatch(courseName, rule.MatchRegex, RegexOptions.IgnoreCase))
            {
                courseMatched = true;
            }

            // Tag match
            if (!courseMatched)
            {
                var ruleTag = NormalizeKey(rule.Tag);
                if (ruleTag is not null && tagSet.Contains(ruleTag))
                {
                    courseMatched = true;
                }
            }

            if (!courseMatched)
            {
                continue;
            }

            // If the rule scopes to a specific issuer, enforce it; otherwise allow the course match.
            if (!string.IsNullOrWhiteSpace(rule.IssuerOverride))
            {
                if (NormalizeKey(rule.IssuerOverride) == normalizedIssuer)
                {
                    return true;
                }
                continue;
            }

            return true;
        }

        return false;
    }

    private static string? NormalizeKey(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;

        var cleaned = value.Trim().TrimEnd('.', ',', ';', ':', '-').ToLowerInvariant();
        cleaned = Regex.Replace(cleaned, @"\s{2,}", " ");
        return string.IsNullOrWhiteSpace(cleaned) ? null : cleaned;
    }
}
