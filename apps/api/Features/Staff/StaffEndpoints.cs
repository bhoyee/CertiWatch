using CertiWatch.Api.Domain.Entities;
using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Infrastructure.Security;
using CertiWatch.Contracts.Dtos;
using CertiWatch.Contracts.Requests;
using CertiWatch.Contracts.Responses;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace CertiWatch.Api.Features.Staff;

public static class StaffEndpoints
{
    private const int MaxImportRows = 1000;

    public static IEndpointRouteBuilder MapStaffEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/staff").RequireAuthorization();
        group.MapGet(string.Empty, ListAsync);
        group.MapPost(string.Empty, CreateAsync);
        group.MapPost("/import", ImportAsync);
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

    // Bulk-create from a client-parsed CSV. Each row is validated independently and bad rows are
    // skipped with a reason rather than failing the whole import - a typo in row 40 of a 60-row
    // spreadsheet shouldn't block the other 59 from importing.
    private static async Task<IResult> ImportAsync(
        ImportStaffRequest request,
        AppDbContext db,
        ITenantContextAccessor accessor,
        CancellationToken token)
    {
        if (!RecordVisibility.IsAdmin(accessor) && !RecordVisibility.IsManager(accessor))
        {
            return Results.Forbid();
        }

        if (request.Rows.Count > MaxImportRows)
        {
            return Results.BadRequest(new { error = "too_many_rows", message = $"Import is limited to {MaxImportRows} rows at a time." });
        }

        var tenantId = accessor.Current.TenantId;
        var skipped = new List<StaffImportRowError>();
        var toAdd = new List<StaffMember>();

        for (var i = 0; i < request.Rows.Count; i++)
        {
            var row = request.Rows[i];
            var name = row.Name?.Trim();
            if (string.IsNullOrWhiteSpace(name))
            {
                skipped.Add(new StaffImportRowError(i + 1, "Missing name"));
                continue;
            }
            if (name.Length > 200)
            {
                skipped.Add(new StaffImportRowError(i + 1, "Name too long"));
                continue;
            }

            toAdd.Add(new StaffMember
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Name = name,
                JobTitle = string.IsNullOrWhiteSpace(row.JobTitle) ? null : row.JobTitle.Trim(),
                StartDate = row.StartDate,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            });
        }

        if (toAdd.Count > 0)
        {
            db.StaffMembers.AddRange(toAdd);
            await db.SaveChangesAsync(token);
        }

        return Results.Ok(new StaffImportResultResponse(toAdd.Count, skipped));
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
