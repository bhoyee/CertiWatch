using CertiWatch.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CertiWatch.Api.Features.Admin;

public static class AdminEndpoints
{
    public static IEndpointRouteBuilder MapAdminEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/admin");
        group.MapGet("/healthz", HealthAsync);
        group.MapGet("/ingestion-logs", LogsAsync);
        return group;
    }

    private static async Task<IResult> HealthAsync(AppDbContext db, CancellationToken token)
    {
        var canConnect = await db.Database.CanConnectAsync(token);
        return canConnect ? Results.Ok(new { status = "ok", timestamp = DateTime.UtcNow }) : Results.Problem("database unavailable");
    }

    private static async Task<IResult> LogsAsync(AppDbContext db, CancellationToken token)
    {
        var logs = await db.AuditLogs.AsNoTracking().OrderByDescending(l => l.CreatedAt).Take(50).ToListAsync(token);
        return Results.Ok(logs.Select(l => new { l.Id, l.Action, l.MetaJson, l.CreatedAt }));
    }
}
