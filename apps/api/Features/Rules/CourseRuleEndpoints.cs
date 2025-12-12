using CertiWatch.Api.Domain.Entities;
using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Infrastructure.Security;
using CertiWatch.Contracts.Dtos;
using CertiWatch.Contracts.Requests;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace CertiWatch.Api.Features.Rules;

public static class CourseRuleEndpoints
{
    public static IEndpointRouteBuilder MapCourseRuleEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/course-rules").RequireAuthorization();
        group.MapGet(string.Empty, ListAsync);
        group.MapPost(string.Empty, CreateAsync);
        group.MapPatch("/{id:guid}", UpdateAsync);
        group.MapDelete("/{id:guid}", DeleteAsync);
        return group;
    }

    private static async Task<IResult> ListAsync(AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        var tenantId = accessor.Current.TenantId;
        var rules = await db.CourseRules.AsNoTracking().Where(r => r.TenantId == null || r.TenantId == tenantId).ToListAsync(token);
        return Results.Ok(rules.Select(ToDto));
    }

    private static async Task<IResult> CreateAsync(
        CreateCourseRuleRequest request,
        AppDbContext db,
        ITenantContextAccessor accessor,
        IValidator<CreateCourseRuleRequest> validator,
        CancellationToken token)
    {
        var validation = await validator.ValidateAsync(request, token);
        if (!validation.IsValid)
        {
            return Results.ValidationProblem(validation.ToDictionary());
        }

        var entity = new CourseRule
        {
            Id = Guid.NewGuid(),
            TenantId = accessor.Current.TenantId,
            CourseName = request.CourseName,
            MatchRegex = request.MatchRegex,
            Tag = request.Tag,
            IssuerOverride = request.IssuerOverride,
            DefaultValidityMonths = request.DefaultValidityMonths,
            IsRenewable = request.IsRenewable,
            IsOneTime = request.IsOneTime,
            CreatedAt = DateTime.UtcNow
        };

        db.CourseRules.Add(entity);
        await db.SaveChangesAsync(token);
        return Results.Created($"/api/course-rules/{entity.Id}", ToDto(entity));
    }

    private static async Task<IResult> UpdateAsync(
        Guid id,
        UpdateCourseRuleRequest request,
        AppDbContext db,
        ITenantContextAccessor accessor,
        IValidator<UpdateCourseRuleRequest> validator,
        CancellationToken token)
    {
        var validation = await validator.ValidateAsync(request, token);
        if (!validation.IsValid)
        {
            return Results.ValidationProblem(validation.ToDictionary());
        }

        var entity = await db.CourseRules.FirstOrDefaultAsync(r => r.Id == id && (r.TenantId == accessor.Current.TenantId || r.TenantId == null), token);
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

        if (!string.IsNullOrWhiteSpace(request.CourseName)) entity.CourseName = request.CourseName;
        if (!string.IsNullOrWhiteSpace(request.MatchRegex)) entity.MatchRegex = request.MatchRegex;
        if (!string.IsNullOrWhiteSpace(request.Tag)) entity.Tag = request.Tag;
        if (!string.IsNullOrWhiteSpace(request.IssuerOverride)) entity.IssuerOverride = request.IssuerOverride;
        if (request.DefaultValidityMonths.HasValue) entity.DefaultValidityMonths = request.DefaultValidityMonths;
        if (request.IsRenewable.HasValue) entity.IsRenewable = request.IsRenewable.Value;
        if (request.IsOneTime.HasValue) entity.IsOneTime = request.IsOneTime.Value;

        await db.SaveChangesAsync(token);
        return Results.Ok(ToDto(entity));
    }

    private static async Task<IResult> DeleteAsync(Guid id, AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        var entity = await db.CourseRules.FirstOrDefaultAsync(r => r.Id == id, token);
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

        db.CourseRules.Remove(entity);
        await db.SaveChangesAsync(token);
        return Results.NoContent();
    }

    private static CourseRuleDto ToDto(CourseRule rule)
        => new(rule.Id, rule.TenantId, rule.CourseName, rule.MatchRegex, rule.Tag, rule.IssuerOverride, rule.DefaultValidityMonths, rule.IsRenewable, rule.IsOneTime, rule.TenantId is null ? 0 : 1, rule.TenantId is null);
}
