using System.Text.Json;
using CertiWatch.Api.Domain.Entities;
using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Infrastructure.Services;
using CertiWatch.Api.Infrastructure.Security;
using CertiWatch.Contracts.Dtos;
using CertiWatch.Contracts.Enums;
using CertiWatch.Contracts.Requests;
using Microsoft.EntityFrameworkCore;

namespace CertiWatch.Api.Features.Sources;

public static class SourcesEndpoints
{
    public static IEndpointRouteBuilder MapSourceEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/sources").RequireAuthorization();
        group.MapGet(string.Empty, ListAsync);
        group.MapPost(string.Empty, CreateAsync);
        group.MapDelete("/{id:guid}", DeleteAsync);
        return group;
    }

    private static async Task<IResult> ListAsync(AppDbContext db, ITenantContextAccessor tenantAccessor, CancellationToken token)
    {
        var tenantId = tenantAccessor.Current.TenantId;
        var sources = await db.Sources.AsNoTracking().Where(s => s.TenantId == tenantId).ToListAsync(token);
        return Results.Ok(sources.Select(ToDto));
    }

    private static async Task<IResult> CreateAsync(SourceRequest request, AppDbContext db, ITenantContextAccessor tenantAccessor, IDateTimeProvider clock, CancellationToken token)
    {
        var entity = new Source
        {
            Id = Guid.NewGuid(),
            TenantId = tenantAccessor.Current.TenantId,
            Type = request.Type,
            DisplayName = request.DisplayName,
            ConfigJson = JsonSerializer.Serialize(request.Config),
            CreatedAt = clock.UtcNow
        };

        db.Sources.Add(entity);
        await db.SaveChangesAsync(token);
        return Results.Created($"/api/sources/{entity.Id}", ToDto(entity));
    }

    private static async Task<IResult> DeleteAsync(Guid id, AppDbContext db, ITenantContextAccessor tenantAccessor, CancellationToken token)
    {
        var entity = await db.Sources.FirstOrDefaultAsync(s => s.Id == id && s.TenantId == tenantAccessor.Current.TenantId, token);
        if (entity is null)
        {
            return Results.NotFound();
        }

        db.Sources.Remove(entity);
        await db.SaveChangesAsync(token);
        return Results.NoContent();
    }

    private static SourceDto ToDto(Source source)
        => new(
            source.Id,
            source.Type,
            source.DisplayName,
            JsonSerializer.Deserialize<Dictionary<string, string>>(source.ConfigJson) ?? new Dictionary<string, string>(),
            source.CreatedAt);
}
