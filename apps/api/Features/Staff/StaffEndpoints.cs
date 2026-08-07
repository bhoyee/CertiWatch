using CertiWatch.Api.Domain.Entities;
using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Infrastructure.Security;
using CertiWatch.Contracts.Dtos;
using CertiWatch.Contracts.Requests;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace CertiWatch.Api.Features.Staff;

public static class StaffEndpoints
{
    public static IEndpointRouteBuilder MapStaffEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/staff").RequireAuthorization();
        group.MapGet(string.Empty, ListAsync);
        group.MapPost(string.Empty, CreateAsync);
        group.MapPatch("/{id:guid}", UpdateAsync);
        group.MapDelete("/{id:guid}", DeleteAsync);
        return group;
    }

    private static async Task<IResult> ListAsync(AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        if (!RecordVisibility.IsAdmin(accessor) && !RecordVisibility.IsManager(accessor))
        {
            return Results.Forbid();
        }

        var tenantId = accessor.Current.TenantId;
        var staff = await db.StaffMembers.AsNoTracking()
            .Where(s => s.TenantId == tenantId)
            .OrderBy(s => s.Name)
            .ToListAsync(token);
        return Results.Ok(staff.Select(ToDto));
    }

    private static async Task<IResult> CreateAsync(
        CreateStaffMemberRequest request,
        AppDbContext db,
        ITenantContextAccessor accessor,
        IValidator<CreateStaffMemberRequest> validator,
        CancellationToken token)
    {
        if (!RecordVisibility.IsAdmin(accessor) && !RecordVisibility.IsManager(accessor))
        {
            return Results.Forbid();
        }

        var validation = await validator.ValidateAsync(request, token);
        if (!validation.IsValid)
        {
            return Results.ValidationProblem(validation.ToDictionary());
        }

        var entity = new StaffMember
        {
            Id = Guid.NewGuid(),
            TenantId = accessor.Current.TenantId,
            Name = request.Name,
            JobTitle = request.JobTitle,
            StartDate = request.StartDate,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        db.StaffMembers.Add(entity);
        await db.SaveChangesAsync(token);
        return Results.Created($"/api/staff/{entity.Id}", ToDto(entity));
    }

    private static async Task<IResult> UpdateAsync(
        Guid id,
        UpdateStaffMemberRequest request,
        AppDbContext db,
        ITenantContextAccessor accessor,
        CancellationToken token)
    {
        if (!RecordVisibility.IsAdmin(accessor) && !RecordVisibility.IsManager(accessor))
        {
            return Results.Forbid();
        }

        var tenantId = accessor.Current.TenantId;
        var entity = await db.StaffMembers.FirstOrDefaultAsync(s => s.Id == id && s.TenantId == tenantId, token);
        if (entity is null)
        {
            return Results.NotFound();
        }

        if (!string.IsNullOrWhiteSpace(request.Name)) entity.Name = request.Name;
        if (request.JobTitle is not null) entity.JobTitle = request.JobTitle;
        if (request.StartDate.HasValue) entity.StartDate = request.StartDate;
        if (request.IsActive.HasValue) entity.IsActive = request.IsActive.Value;

        await db.SaveChangesAsync(token);
        return Results.Ok(ToDto(entity));
    }

    private static async Task<IResult> DeleteAsync(Guid id, AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        if (!RecordVisibility.IsAdmin(accessor) && !RecordVisibility.IsManager(accessor))
        {
            return Results.Forbid();
        }

        var tenantId = accessor.Current.TenantId;
        var entity = await db.StaffMembers.FirstOrDefaultAsync(s => s.Id == id && s.TenantId == tenantId, token);
        if (entity is null)
        {
            return Results.NotFound();
        }

        db.StaffMembers.Remove(entity);
        await db.SaveChangesAsync(token);
        return Results.NoContent();
    }

    private static StaffMemberDto ToDto(StaffMember staff)
        => new(staff.Id, staff.Name, staff.JobTitle, staff.StartDate, staff.IsActive, staff.CreatedAt);
}
