using CertiWatch.Api.Domain.Entities;
using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Infrastructure.Security;
using CertiWatch.Contracts.Dtos;
using CertiWatch.Contracts.Requests;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace CertiWatch.Api.Features.Requirements;

public static class RequirementTypeEndpoints
{
    public static IEndpointRouteBuilder MapRequirementTypeEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/requirement-types").RequireAuthorization();
        group.MapGet(string.Empty, ListAsync);
        group.MapPost(string.Empty, CreateAsync);
        group.MapPatch("/{id:guid}", UpdateAsync);
        group.MapDelete("/{id:guid}", DeleteAsync);
        return group;
    }

    private static async Task<IResult> ListAsync(AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        if (!RecordVisibility.IsAdmin(accessor))
        {
            return Results.Forbid();
        }

        var tenantId = accessor.Current.TenantId;
        var types = await db.RequirementTypes.AsNoTracking().Where(r => r.TenantId == null || r.TenantId == tenantId).ToListAsync(token);
        return Results.Ok(types.Select(ToDto));
    }

    private static async Task<IResult> CreateAsync(
        CreateRequirementTypeRequest request,
        AppDbContext db,
        ITenantContextAccessor accessor,
        IValidator<CreateRequirementTypeRequest> validator,
        CancellationToken token)
    {
        if (!RecordVisibility.IsAdmin(accessor))
        {
            return Results.Forbid();
        }

        var validation = await validator.ValidateAsync(request, token);
        if (!validation.IsValid)
        {
            return Results.ValidationProblem(validation.ToDictionary());
        }

        var entity = new RequirementType
        {
            Id = Guid.NewGuid(),
            TenantId = accessor.Current.TenantId,
            Name = request.Name,
            DefaultValidityMonths = request.DefaultValidityMonths,
            IsRenewable = request.IsRenewable,
            CreatedAt = DateTime.UtcNow
        };

        db.RequirementTypes.Add(entity);
        await db.SaveChangesAsync(token);
        return Results.Created($"/api/requirement-types/{entity.Id}", ToDto(entity));
    }

    private static async Task<IResult> UpdateAsync(
        Guid id,
        UpdateRequirementTypeRequest request,
        AppDbContext db,
        ITenantContextAccessor accessor,
        IValidator<UpdateRequirementTypeRequest> validator,
        CancellationToken token)
    {
        if (!RecordVisibility.IsAdmin(accessor))
        {
            return Results.Forbid();
        }

        var validation = await validator.ValidateAsync(request, token);
        if (!validation.IsValid)
        {
            return Results.ValidationProblem(validation.ToDictionary());
        }

        var entity = await db.RequirementTypes.FirstOrDefaultAsync(r => r.Id == id && (r.TenantId == accessor.Current.TenantId || r.TenantId == null), token);
        if (entity is null)
        {
            return Results.NotFound();
        }

        var isSuperAdmin = string.Equals(accessor.Current.Role, "superadmin", StringComparison.OrdinalIgnoreCase);
        if (entity.TenantId == null && !isSuperAdmin)
        {
            return Results.Forbid();
        }
        if (entity.TenantId.HasValue && entity.TenantId != accessor.Current.TenantId && !isSuperAdmin)
        {
            return Results.Forbid();
        }

        if (!string.IsNullOrWhiteSpace(request.Name)) entity.Name = request.Name;
        if (request.DefaultValidityMonths.HasValue) entity.DefaultValidityMonths = request.DefaultValidityMonths;
        if (request.IsRenewable.HasValue) entity.IsRenewable = request.IsRenewable.Value;

        await db.SaveChangesAsync(token);
        return Results.Ok(ToDto(entity));
    }

    private static async Task<IResult> DeleteAsync(Guid id, AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        if (!RecordVisibility.IsAdmin(accessor))
        {
            return Results.Forbid();
        }

        var entity = await db.RequirementTypes.FirstOrDefaultAsync(r => r.Id == id, token);
        if (entity is null)
        {
            return Results.NotFound();
        }

        var isSuperAdmin = string.Equals(accessor.Current.Role, "superadmin", StringComparison.OrdinalIgnoreCase);
        if (entity.TenantId == null && !isSuperAdmin)
        {
            return Results.Forbid();
        }
        if (entity.TenantId.HasValue && entity.TenantId != accessor.Current.TenantId && !isSuperAdmin)
        {
            return Results.Forbid();
        }

        db.RequirementTypes.Remove(entity);
        await db.SaveChangesAsync(token);
        return Results.NoContent();
    }

    private static RequirementTypeDto ToDto(RequirementType type)
        => new(type.Id, type.TenantId, type.Name, type.DefaultValidityMonths, type.IsRenewable, type.TenantId is null);
}
