using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Infrastructure.Security;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;
using System.IO;
using CertiWatch.Api.Configuration;
using Microsoft.Extensions.Options;

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
        var document = await db.Documents
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == id && d.TenantId == accessor.Current.TenantId, token);

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

    private static async Task<IResult> StreamAsync(
        Guid id,
        AppDbContext db,
        ITenantContextAccessor accessor,
        HttpContext httpContext,
        CancellationToken token)
    {
        var document = await db.Documents
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == id && d.TenantId == accessor.Current.TenantId, token);

        if (document is null || string.IsNullOrWhiteSpace(document.PathOrUrl) || !File.Exists(document.PathOrUrl))
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

        var stream = File.OpenRead(document.PathOrUrl);

        // Force inline preview instead of attachment
        httpContext.Response.Headers["Content-Disposition"] =
            $"inline; filename=\"{document.FileName}\"";

        // Optional hardening
        httpContext.Response.Headers["X-Content-Type-Options"] = "nosniff";

        return Results.File(stream, contentType, enableRangeProcessing: true);
    }

    private static async Task<IResult> ReprocessAsync(
        Guid id,
        AppDbContext db,
        ITenantContextAccessor accessor,
        CancellationToken token)
    {
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
