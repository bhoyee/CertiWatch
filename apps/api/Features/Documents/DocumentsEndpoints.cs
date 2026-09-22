using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Infrastructure.Security;
using CertiWatch.Api.Infrastructure.Services;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;
using CertiWatch.Storage;

namespace CertiWatch.Api.Features.Documents;

public static class DocumentsEndpoints
{
    private static readonly FileExtensionContentTypeProvider MimeProvider = new();

    public static IEndpointRouteBuilder MapDocumentEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/documents").RequireAuthorization();
        group.MapGet("/{id:guid}/preview", PreviewAsync);
        group.MapGet("/{id:guid}/file", StreamAsync);
        group.MapPost("/{id:guid}/reprocess", ReprocessAsync);
        return group;
    }

    private static async Task<IResult> PreviewAsync(
        Guid id,
        AppDbContext db,
        ITenantContextAccessor accessor,
        CancellationToken token)
    {
        var tenantId = accessor.Current.TenantId;
        if (RecordVisibility.IsViewer(accessor) || RecordVisibility.IsManager(accessor))
        {
            var scope = await RecordVisibility.GetScopeAsync(db, accessor, token);
            var recordQuery = RecordVisibility.ApplyScope(
                db.Records.AsNoTracking().Where(r => r.TenantId == tenantId),
                scope);
            var allowed = recordQuery.AsEnumerable().Any(r => r.DocumentId == id);
            if (!allowed)
            {
                return Results.NotFound();
            }
        }

        var document = await db.Documents
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == id && d.TenantId == tenantId, token);

        if (document is null)
        {
            return Results.NotFound();
        }

        return Results.Ok(new
        {
            document.Id,
            document.FileName,
            document.MimeType,
            document.PathOrUrl,
            document.ProcessingStatus
        });
    }

    private const string CloudReferencePrefix = "cloudref:";

    private static async Task<IResult> StreamAsync(
        Guid id,
        AppDbContext db,
        ITenantContextAccessor accessor,
        IFileStorage fileStorage,
        ICloudDocumentTransfer cloudFetcher,
        HttpContext httpContext,
        CancellationToken token)
    {
        var tenantId = accessor.Current.TenantId;
        if (RecordVisibility.IsViewer(accessor) || RecordVisibility.IsManager(accessor))
        {
            var scope = await RecordVisibility.GetScopeAsync(db, accessor, token);
            var recordQuery = RecordVisibility.ApplyScope(
                db.Records.AsNoTracking().Where(r => r.TenantId == tenantId),
                scope);
            var allowed = recordQuery.AsEnumerable().Any(r => r.DocumentId == id);
            if (!allowed)
            {
                return Results.NotFound();
            }
        }

        var document = await db.Documents
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == id && d.TenantId == tenantId, token);

        if (document is null || string.IsNullOrWhiteSpace(document.PathOrUrl))
        {
            return Results.NotFound();
        }

        // Resolve a good content type
        string contentType = document.MimeType ?? string.Empty;

        if (string.IsNullOrWhiteSpace(contentType))
        {
            if (!MimeProvider.TryGetContentType(document.FileName, out contentType))
            {
                // If most of your stored docs are PDF, default to PDF
                contentType = "application/pdf";
            }
        }

        Stream stream;
        // A live-proxied network stream from Drive/Graph doesn't support seeking the way a local
        // disk or S3 stream does - range processing needs that, so it's only enabled for the
        // archived-copy path.
        var enableRangeProcessing = true;
        if (document.PathOrUrl.StartsWith(CloudReferencePrefix, StringComparison.Ordinal))
        {
            // No permanent copy of this one was ever kept (see DocumentIngestionWorker.
            // SetCloudReference) - fetch it live from Google Drive/OneDrive instead.
            var cloudFileId = document.PathOrUrl[CloudReferencePrefix.Length..];
            var result = await cloudFetcher.FetchAsync(tenantId, document.SourceId, cloudFileId, token);
            if (result is null)
            {
                return Results.Problem(
                    "This document could not be retrieved from Google Drive/OneDrive - it may have been moved, deleted, or access revoked.",
                    statusCode: 502);
            }
            stream = result.Content;
            enableRangeProcessing = false;
            if (!string.IsNullOrWhiteSpace(result.ContentType))
            {
                contentType = result.ContentType;
            }
        }
        else
        {
            if (!await fileStorage.ExistsAsync(document.PathOrUrl, token))
            {
                return Results.NotFound();
            }
            stream = await fileStorage.OpenReadAsync(document.PathOrUrl, token);
        }

        // Force inline preview instead of attachment
        httpContext.Response.Headers["Content-Disposition"] =
            $"inline; filename=\"{document.FileName}\"";

        // Optional hardening
        httpContext.Response.Headers["X-Content-Type-Options"] = "nosniff";

        return Results.File(stream, contentType, enableRangeProcessing: enableRangeProcessing);
    }

    private static async Task<IResult> ReprocessAsync(
        Guid id,
        AppDbContext db,
        ITenantContextAccessor accessor,
        CancellationToken token)
    {
        if (!RecordVisibility.IsAdmin(accessor))
        {
            return Results.Forbid();
        }

        var document = await db.Documents
            .Include(d => d.Records)
            .FirstOrDefaultAsync(d => d.Id == id && d.TenantId == accessor.Current.TenantId, token);

        if (document is null)
        {
            return Results.NotFound();
        }

        foreach (var record in document.Records)
        {
            record.ProcessingStatus = Contracts.Enums.ProcessingStatus.NeedsReview;
            record.ReviewReason = "force_reprocess";
            record.ReviewNotes = null;
            record.ReviewedAt = null;
            record.ReviewedBy = null;
        }

        document.ProcessedAt = null;
        document.ProcessingStatus = Contracts.Enums.ProcessingStatus.Pending;

        await db.SaveChangesAsync(token);
        return Results.Ok(new { queued = true, message = "Marked for reprocess; re-upload will be processed again." });
    }
}
