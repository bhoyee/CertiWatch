using System.Text.Json;
using CertiWatch.Api.Domain.Entities;
using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Infrastructure.Services;
using CertiWatch.Parsing;
using CertiWatch.Parsing.Rules;
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

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var docEvent in _queue.ReadAllAsync(stoppingToken))
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var inference = scope.ServiceProvider.GetRequiredService<IRuleInferenceService>();

                var document = new Document
                {
                    Id = Guid.NewGuid(),
                    TenantId = docEvent.TenantId,
                    SourceId = docEvent.SourceId,
                    FileName = docEvent.FileName,
                    FileHash = docEvent.FileHash,
                    PathOrUrl = docEvent.PathOrUrl,
                    MimeType = docEvent.MimeType,
                    ProcessingStatus = docEvent.InitialStatus,
                    CreatedAt = docEvent.DetectedAt
                };

                var parsed = _pipeline.Parse(string.Join('\n', docEvent.ExtractedFields.Select(kv => $"{kv.Key}:{kv.Value}")));
                var staff = parsed.Result.StaffName ?? docEvent.ExtractedFields.GetValueOrDefault("staff_name") ?? "Unknown";
                var course = parsed.Result.CourseName ?? docEvent.ExtractedFields.GetValueOrDefault("course_name") ?? "Unknown Course";
                var issuer = parsed.Result.Issuer ?? docEvent.ExtractedFields.GetValueOrDefault("issuer");
                var issueDate = parsed.Result.IssueDate ?? TryParse(docEvent.ExtractedFields.GetValueOrDefault("issue_date"));
                var expiryDate = parsed.Result.ExpiryDate ?? TryParse(docEvent.ExtractedFields.GetValueOrDefault("expiry_date"));

                if (!expiryDate.HasValue)
                {
                    var match = await inference.InferAsync(docEvent.TenantId, course, issuer, docEvent.VendorHints, issueDate, stoppingToken);
                    if (match is not null && match.ValidityMonths.HasValue && issueDate.HasValue)
                    {
                        expiryDate = issueDate.Value.AddMonths(match.ValidityMonths.Value);
                    }
                }

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
                    ExpiryDerived = !parsed.Result.ExpiryDate.HasValue && expiryDate.HasValue,
                    Confidence = (decimal)parsed.Result.Confidence,
                    ProcessingStatus = docEvent.InitialStatus,
                    FieldsJson = JsonSerializer.Serialize(docEvent.ExtractedFields),
                    CreatedAt = docEvent.DetectedAt,
                    UpdatedAt = docEvent.DetectedAt
                };

                db.Documents.Add(document);
                db.Records.Add(record);
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
}
