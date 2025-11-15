using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;

namespace CertiWatch.Api.Features.Documents;

public static class DocumentsEndpoints
{
    public static IEndpointRouteBuilder MapDocumentEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/documents").RequireAuthorization();
        group.MapGet("/{id:guid}/preview", PreviewAsync);
        return group;
    }

    private static async Task<IResult> PreviewAsync(Guid id, AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        var document = await db.Documents.AsNoTracking().FirstOrDefaultAsync(d => d.Id == id && d.TenantId == accessor.Current.TenantId, token);
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
}
