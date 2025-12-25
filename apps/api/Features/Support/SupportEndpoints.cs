using CertiWatch.Api.Domain.Entities;
using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;

namespace CertiWatch.Api.Features.Support;

public static class SupportEndpoints
{
    public static IEndpointRouteBuilder MapSupportEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/support").RequireAuthorization();
        group.MapGet("/tickets", ListAsync);
        group.MapGet("/tickets/{id:guid}", GetAsync);
        group.MapPost("/tickets", CreateAsync);
        group.MapPost("/tickets/{id:guid}/messages", ReplyAsync);
        group.MapPatch("/tickets/{id:guid}/assign", AssignAsync);
        group.MapPatch("/tickets/{id:guid}/status", UpdateStatusAsync);
        return routes;
    }

    private sealed record TicketDto(
        Guid Id,
        string Subject,
        string Status,
        string AssignedRole,
        Guid? AssignedToUserId,
        Guid? CreatedByUserId,
        DateTime CreatedAt,
        DateTime UpdatedAt);

    private sealed record TicketDetailDto(
        Guid Id,
        string Subject,
        string Body,
        string Status,
        string AssignedRole,
        Guid? AssignedToUserId,
        Guid? CreatedByUserId,
        DateTime CreatedAt,
        DateTime UpdatedAt,
        IEnumerable<MessageDto> Messages);

    private sealed record MessageDto(Guid Id, Guid? AuthorUserId, string Body, DateTime CreatedAt);
    private sealed record CreateTicketRequest(string Subject, string Body, Guid? RecordId, string? PageContext);
    private sealed record ReplyRequest(string Body);
    private sealed record AssignRequest(Guid? AssignedToUserId, string? AssignedRole);
    private sealed record StatusRequest(string Status);

    private static bool IsAdmin(ITenantContextAccessor accessor) =>
        accessor.Current.Role.Equals("admin", StringComparison.OrdinalIgnoreCase) ||
        accessor.Current.Role.Equals("superadmin", StringComparison.OrdinalIgnoreCase);

    private static bool IsManager(ITenantContextAccessor accessor) =>
        accessor.Current.Role.Equals("manager", StringComparison.OrdinalIgnoreCase);

    private static bool IsViewer(ITenantContextAccessor accessor) =>
        accessor.Current.Role.Equals("viewer", StringComparison.OrdinalIgnoreCase);

    private static async Task<IResult> ListAsync(AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        var tenantId = accessor.Current.TenantId;
        var userId = accessor.Current.UserId;
        var query = db.SupportTickets.AsNoTracking().Where(t => t.TenantId == tenantId);

        if (IsViewer(accessor))
        {
            query = query.Where(t => t.CreatedByUserId == userId);
        }
        else if (IsManager(accessor))
        {
            var viewers = await db.Users.AsNoTracking()
                .Where(u => u.TenantId == tenantId && u.InvitedByUserId == userId && u.Role.ToLower() == "viewer")
                .Select(u => u.Id)
                .ToListAsync(token);
            query = query.Where(t => t.CreatedByUserId == userId || (t.CreatedByUserId != null && viewers.Contains(t.CreatedByUserId.Value)));
        }
        // Admins see all within tenant

        var items = await query
            .OrderByDescending(t => t.UpdatedAt)
            .Take(200)
            .Select(t => new TicketDto(t.Id, t.Subject, t.Status, t.AssignedRole, t.AssignedToUserId, t.CreatedByUserId, t.CreatedAt, t.UpdatedAt))
            .ToListAsync(token);

        return Results.Ok(items);
    }

    private static async Task<IResult> GetAsync(Guid id, AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        var ticket = await db.SupportTickets
            .AsNoTracking()
            .Include(t => t.Messages.OrderBy(m => m.CreatedAt))
            .FirstOrDefaultAsync(t => t.Id == id && t.TenantId == accessor.Current.TenantId, token);

        if (ticket is null || !await CanAccessAsync(db, accessor, ticket, token))
        {
            return Results.NotFound();
        }

        var dto = new TicketDetailDto(
            ticket.Id,
            ticket.Subject,
            ticket.Body,
            ticket.Status,
            ticket.AssignedRole,
            ticket.AssignedToUserId,
            ticket.CreatedByUserId,
            ticket.CreatedAt,
            ticket.UpdatedAt,
            ticket.Messages.Select(m => new MessageDto(m.Id, m.AuthorUserId, m.Body, m.CreatedAt)).ToList());

        return Results.Ok(dto);
    }

    private static async Task<IResult> CreateAsync(
        CreateTicketRequest request,
        AppDbContext db,
        ITenantContextAccessor accessor,
        CancellationToken token)
    {
        if (string.IsNullOrWhiteSpace(request.Subject) || string.IsNullOrWhiteSpace(request.Body))
        {
            return Results.BadRequest(new { error = "subject_and_body_required" });
        }

        var tenantId = accessor.Current.TenantId;
        var userId = accessor.Current.UserId;
        var ticket = new SupportTicket
        {
            TenantId = tenantId,
            CreatedByUserId = userId,
            Subject = request.Subject.Trim(),
            Body = request.Body.Trim(),
            RecordId = request.RecordId,
            PageContext = request.PageContext,
            Status = "open"
        };

        if (IsViewer(accessor))
        {
            ticket.AssignedRole = "manager";
            var managerId = await db.Users.AsNoTracking()
                .Where(u => u.Id == userId)
                .Select(u => u.InvitedByUserId)
                .FirstOrDefaultAsync(token);
            ticket.AssignedToUserId = managerId;
            if (managerId == null)
            {
                ticket.AssignedRole = "admin";
            }
        }
        else if (IsManager(accessor))
        {
            ticket.AssignedRole = "admin";
        }
        else if (IsAdmin(accessor))
        {
            ticket.AssignedRole = "support";
        }

        db.SupportTickets.Add(ticket);
        db.SupportMessages.Add(new SupportMessage
        {
            TicketId = ticket.Id,
            AuthorUserId = userId,
            Body = ticket.Body
        });

        await db.SaveChangesAsync(token);

        return Results.Ok(new { ticket.Id, ticket.AssignedRole, ticket.Status });
    }

    private static async Task<IResult> ReplyAsync(
        Guid id,
        ReplyRequest request,
        AppDbContext db,
        ITenantContextAccessor accessor,
        CancellationToken token)
    {
        var ticket = await db.SupportTickets.FirstOrDefaultAsync(t => t.Id == id && t.TenantId == accessor.Current.TenantId, token);
        if (ticket is null || !await CanAccessAsync(db, accessor, ticket, token))
        {
            return Results.NotFound();
        }

        if (string.IsNullOrWhiteSpace(request.Body))
        {
            return Results.BadRequest(new { error = "body_required" });
        }

        ticket.UpdatedAt = DateTime.UtcNow;
        db.SupportMessages.Add(new SupportMessage
        {
            TicketId = ticket.Id,
            AuthorUserId = accessor.Current.UserId,
            Body = request.Body.Trim()
        });
        await db.SaveChangesAsync(token);
        return Results.NoContent();
    }

    private static async Task<IResult> AssignAsync(
        Guid id,
        AssignRequest request,
        AppDbContext db,
        ITenantContextAccessor accessor,
        CancellationToken token)
    {
        if (!IsAdmin(accessor) && !IsManager(accessor))
        {
            return Results.Forbid();
        }

        var ticket = await db.SupportTickets.FirstOrDefaultAsync(t => t.Id == id && t.TenantId == accessor.Current.TenantId, token);
        if (ticket is null)
        {
            return Results.NotFound();
        }

        ticket.AssignedToUserId = request.AssignedToUserId;
        if (!string.IsNullOrWhiteSpace(request.AssignedRole))
        {
            ticket.AssignedRole = request.AssignedRole.Trim().ToLower();
        }
        ticket.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(token);
        return Results.NoContent();
    }

    private static async Task<IResult> UpdateStatusAsync(
        Guid id,
        StatusRequest request,
        AppDbContext db,
        ITenantContextAccessor accessor,
        CancellationToken token)
    {
        var ticket = await db.SupportTickets.FirstOrDefaultAsync(t => t.Id == id && t.TenantId == accessor.Current.TenantId, token);
        if (ticket is null || !await CanAccessAsync(db, accessor, ticket, token))
        {
            return Results.NotFound();
        }

        if (string.IsNullOrWhiteSpace(request.Status))
        {
            return Results.BadRequest(new { error = "status_required" });
        }

        ticket.Status = request.Status.Trim().ToLower();
        ticket.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(token);
        return Results.NoContent();
    }

    private static async Task<bool> CanAccessAsync(AppDbContext db, ITenantContextAccessor accessor, SupportTicket ticket, CancellationToken token)
    {
        var tenantId = accessor.Current.TenantId;
        if (ticket.TenantId != tenantId) return false;
        var userId = accessor.Current.UserId;

        if (IsAdmin(accessor)) return true;
        if (IsViewer(accessor)) return ticket.CreatedByUserId == userId;

        if (IsManager(accessor))
        {
            if (ticket.CreatedByUserId == userId) return true;
            var viewers = await db.Users.AsNoTracking()
                .Where(u => u.TenantId == tenantId && u.InvitedByUserId == userId && u.Role.ToLower() == "viewer")
                .Select(u => u.Id)
                .ToListAsync(token);
            return ticket.CreatedByUserId != null && viewers.Contains(ticket.CreatedByUserId.Value);
        }

        return false;
    }
}
