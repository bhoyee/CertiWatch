using CertiWatch.Api.Configuration;
using CertiWatch.Api.Domain.Entities;
using CertiWatch.Api.Infrastructure.Emails;
using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Infrastructure.Security;
using CertiWatch.Api.Infrastructure.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using System.Linq;
using System.Net;

namespace CertiWatch.Api.Features.Support;

public static class SupportEndpoints
{
    private static readonly string[] ValidPriorities = ["low", "normal", "high", "urgent"];
    private static readonly FileExtensionContentTypeProvider MimeProvider = new();

    public static IEndpointRouteBuilder MapSupportEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/support").RequireAuthorization();
        group.MapGet("/tickets", ListAsync);
        group.MapGet("/tickets/{id:guid}", GetAsync);
        group.MapPost("/tickets", CreateAsync);
        group.MapPost("/tickets/{id:guid}/messages", ReplyAsync);
        group.MapPatch("/tickets/{id:guid}/assign", AssignAsync);
        group.MapPatch("/tickets/{id:guid}/status", UpdateStatusAsync);
        group.MapPatch("/tickets/{id:guid}/priority", UpdatePriorityAsync);
        group.MapDelete("/tickets/{id:guid}", DeleteAsync);
        group.MapPost("/attachments", UploadAttachmentAsync).DisableAntiforgery();
        group.MapGet("/attachments/{id:guid}/file", StreamAttachmentAsync);
        return routes;
    }

    private sealed record TicketDto(
        Guid Id,
        string Subject,
        string Status,
        string Priority,
        string AssignedRole,
        Guid? AssignedToUserId,
        string? AssignedToName,
        Guid? CreatedByUserId,
        string? CreatedByName,
        DateTime CreatedAt,
        DateTime UpdatedAt);

    private sealed record TicketDetailDto(
        Guid Id,
        string Subject,
        string Body,
        string Status,
        string Priority,
        string AssignedRole,
        Guid? AssignedToUserId,
        string? AssignedToName,
        Guid? CreatedByUserId,
        string? CreatedByName,
        DateTime CreatedAt,
        DateTime UpdatedAt,
        IEnumerable<MessageDto> Messages,
        IEnumerable<AttachmentDto> Attachments);

    private sealed record MessageDto(Guid Id, Guid? AuthorUserId, string? AuthorName, bool AuthorIsPlatform, string Body, DateTime CreatedAt);
    private sealed record AttachmentDto(Guid Id, string FileName, string? MimeType, long SizeBytes, string Url, Guid? MessageId, string? UploadedByName, DateTime CreatedAt);
    private sealed record CreateTicketRequest(string Subject, string Body, string? Priority, Guid? RecordId, string? PageContext, List<Guid>? AttachmentIds);
    private sealed record ReplyRequest(string Body, List<Guid>? AttachmentIds);
    private sealed record AssignRequest(Guid? AssignedToUserId, string? AssignedRole);
    private sealed record StatusRequest(string Status);
    private sealed record PriorityRequest(string Priority);

    private static string NormalizePriority(string? priority) =>
        !string.IsNullOrWhiteSpace(priority) && ValidPriorities.Contains(priority.Trim().ToLowerInvariant())
            ? priority.Trim().ToLowerInvariant()
            : "normal";

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
        else if (IsAdmin(accessor))
        {
            var invitedByAdminIds = await db.Users.AsNoTracking()
                .Where(u => u.TenantId == tenantId && u.InvitedByUserId == userId)
                .Select(u => u.Id)
                .ToListAsync(token);

            query = query.Where(t =>
                t.CreatedByUserId == userId ||
                (t.CreatedByUserId != null && invitedByAdminIds.Contains(t.CreatedByUserId.Value)) ||
                t.AssignedRole == "admin" ||
                t.AssignedToUserId == userId);
        }

        var itemsRaw = await query
            .OrderByDescending(t => t.UpdatedAt)
            .Take(200)
            .ToListAsync(token);

        var userIds = itemsRaw
            .SelectMany(t => new[] { t.CreatedByUserId, t.AssignedToUserId }.Where(id => id.HasValue).Select(id => id!.Value))
            .Distinct()
            .ToList();
        var userLookup = await db.Users.AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.Name ?? u.Email, token);

        var items = itemsRaw.Select(t =>
            new TicketDto(
                t.Id,
                t.Subject,
                t.Status,
                NormalizePriority(t.Priority),
                t.AssignedRole,
                t.AssignedToUserId,
                t.AssignedToUserId.HasValue && userLookup.TryGetValue(t.AssignedToUserId.Value, out var an) ? an : null,
                t.CreatedByUserId,
                t.CreatedByUserId.HasValue && userLookup.TryGetValue(t.CreatedByUserId.Value, out var cn) ? cn : null,
                t.CreatedAt,
                t.UpdatedAt)).ToList();

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

        var attachments = await db.SupportAttachments.AsNoTracking()
            .Where(a => a.TenantId == accessor.Current.TenantId && a.TicketId == id)
            .OrderBy(a => a.CreatedAt)
            .ToListAsync(token);

        var ids = ticket.Messages.Select(m => m.AuthorUserId).Where(x => x.HasValue).Select(x => x!.Value).ToList();
        if (ticket.CreatedByUserId.HasValue) ids.Add(ticket.CreatedByUserId.Value);
        if (ticket.AssignedToUserId.HasValue) ids.Add(ticket.AssignedToUserId.Value);
        ids.AddRange(attachments.Where(a => a.UploadedByUserId.HasValue).Select(a => a.UploadedByUserId!.Value));
        var userDetails = await db.Users.AsNoTracking()
            .Where(u => ids.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => new { Name = u.Name ?? u.Email, u.Role }, token);
        var userLookup = userDetails.ToDictionary(kv => kv.Key, kv => kv.Value.Name);

        var dto = new TicketDetailDto(
            ticket.Id,
            ticket.Subject,
            ticket.Body,
            ticket.Status,
            NormalizePriority(ticket.Priority),
            ticket.AssignedRole,
            ticket.AssignedToUserId,
            ticket.AssignedToUserId.HasValue && userLookup.TryGetValue(ticket.AssignedToUserId.Value, out var an) ? an : null,
            ticket.CreatedByUserId,
            ticket.CreatedByUserId.HasValue && userLookup.TryGetValue(ticket.CreatedByUserId.Value, out var cn) ? cn : null,
            ticket.CreatedAt,
            ticket.UpdatedAt,
            ticket.Messages.Select(m =>
                new MessageDto(
                    m.Id,
                    m.AuthorUserId,
                    m.AuthorUserId.HasValue && userLookup.TryGetValue(m.AuthorUserId.Value, out var mn) ? mn : null,
                    m.AuthorUserId.HasValue && userDetails.TryGetValue(m.AuthorUserId.Value, out var mr) && mr.Role.Equals("superadmin", StringComparison.OrdinalIgnoreCase),
                    m.Body,
                    m.CreatedAt)).ToList(),
            attachments.Select(a =>
                new AttachmentDto(
                    a.Id,
                    a.FileName,
                    a.MimeType,
                    a.SizeBytes,
                    $"/api/support/attachments/{a.Id}/file",
                    a.MessageId,
                    a.UploadedByUserId.HasValue && userLookup.TryGetValue(a.UploadedByUserId.Value, out var upn) ? upn : null,
                    a.CreatedAt)).ToList());

        return Results.Ok(dto);
    }

    private static async Task<IResult> CreateAsync(
        CreateTicketRequest request,
        AppDbContext db,
        ITenantContextAccessor accessor,
        IEmailService emailService,
        IOptions<MagicLinkOptions> magicOptions,
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
            Body = RichTextSanitizer.Sanitize(request.Body),
            Priority = NormalizePriority(request.Priority),
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

        var openingMessage = new SupportMessage
        {
            TicketId = ticket.Id,
            AuthorUserId = userId,
            Body = ticket.Body
        };
        db.SupportTickets.Add(ticket);
        db.SupportMessages.Add(openingMessage);

        await ReparentAttachmentsAsync(db, tenantId, userId, request.AttachmentIds, ticket.Id, openingMessage.Id, token);

        await db.SaveChangesAsync(token);

        await NotifyAssigneesAsync(db, emailService, ticket, "created", magicOptions.Value.BaseUrl, token);

        return Results.Ok(new { ticket.Id, ticket.AssignedRole, ticket.Status });
    }

    // Attachments (inline images from the rich text editor, or picked files) are uploaded to a
    // tenant-scoped holding area before the ticket/message they belong to exists, since the "new
    // ticket" form and reply composer both need to accept them pre-submit. This claims whichever
    // of the caller's own not-yet-attached uploads were referenced, tying them to the real ticket
    // (and message, for a reply) that was just created.
    private static async Task ReparentAttachmentsAsync(
        AppDbContext db,
        Guid tenantId,
        Guid userId,
        List<Guid>? attachmentIds,
        Guid ticketId,
        Guid messageId,
        CancellationToken token)
    {
        if (attachmentIds is null || attachmentIds.Count == 0) return;

        var attachments = await db.SupportAttachments
            .Where(a => a.TenantId == tenantId && a.TicketId == null && a.UploadedByUserId == userId && attachmentIds.Contains(a.Id))
            .ToListAsync(token);

        foreach (var attachment in attachments)
        {
            attachment.TicketId = ticketId;
            attachment.MessageId = messageId;
        }
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
        var message = new SupportMessage
        {
            TicketId = ticket.Id,
            AuthorUserId = accessor.Current.UserId,
            Body = RichTextSanitizer.Sanitize(request.Body)
        };
        db.SupportMessages.Add(message);

        await ReparentAttachmentsAsync(db, accessor.Current.TenantId, accessor.Current.UserId, request.AttachmentIds, ticket.Id, message.Id, token);

        var authorName = await db.Users.AsNoTracking().Where(u => u.Id == accessor.Current.UserId)
            .Select(u => u.Name ?? u.Email).FirstOrDefaultAsync(token) ?? "Someone";
        AddTenantNotification(db, ticket, "support_reply", ticket.Subject, $"{authorName} replied to this ticket.");
        MaybeAddPlatformNotification(db, ticket, "support_reply", ticket.Subject, $"{authorName} replied to a ticket assigned to platform support.");

        await db.SaveChangesAsync(token);
        return Results.NoContent();
    }

    // Tenant staff act as one team on this bell already (see Notification's own doc comment), so
    // any ticket activity - including a tenant user replying to their own ticket - surfaces here
    // the same way an "expiring" or "needs_review" notification would.
    private static void AddTenantNotification(AppDbContext db, SupportTicket ticket, string type, string title, string body)
    {
        db.Notifications.Add(new Notification
        {
            TenantId = ticket.TenantId,
            TicketId = ticket.Id,
            Type = type,
            Title = title,
            Body = body
        });
    }

    // Only tickets actually escalated to CertiWatch's own staff are worth surfacing on the
    // platform console - a purely internal manager/admin ticket never reaches a superadmin's
    // queue, so it shouldn't page one either.
    private static void MaybeAddPlatformNotification(AppDbContext db, SupportTicket ticket, string type, string title, string body)
    {
        var role = ticket.AssignedRole?.ToLowerInvariant();
        if (role != "support" && role != "superadmin") return;

        db.PlatformNotifications.Add(new PlatformNotification
        {
            TicketId = ticket.Id,
            TenantId = ticket.TenantId,
            Type = type,
            Title = title,
            Body = body
        });
    }

    private static async Task<IResult> DeleteAsync(
        Guid id,
        AppDbContext db,
        ITenantContextAccessor accessor,
        CancellationToken token)
    {
        var ticket = await db.SupportTickets
            .Include(t => t.Messages)
            .FirstOrDefaultAsync(t => t.Id == id && t.TenantId == accessor.Current.TenantId, token);
        if (ticket is null || !await CanAccessAsync(db, accessor, ticket, token))
        {
            return Results.NotFound();
        }

        // Allow delete for: creator, manager of creator, admin (if invited/assigned as per access rules).
        var attachments = await db.SupportAttachments
            .Where(a => a.TenantId == accessor.Current.TenantId && a.TicketId == id)
            .ToListAsync(token);
        foreach (var attachment in attachments)
        {
            TryDeleteFile(attachment.PathOrUrl);
        }
        db.SupportAttachments.RemoveRange(attachments);
        db.SupportMessages.RemoveRange(ticket.Messages);
        db.SupportTickets.Remove(ticket);
        await db.SaveChangesAsync(token);
        return Results.NoContent();
    }

    private static void TryDeleteFile(string path)
    {
        try
        {
            if (File.Exists(path)) File.Delete(path);
        }
        catch
        {
            // best-effort cleanup; an orphaned file on disk is harmless
        }
    }

    private static async Task<IResult> AssignAsync(
        Guid id,
        AssignRequest request,
        AppDbContext db,
        ITenantContextAccessor accessor,
        IEmailService emailService,
        IOptions<MagicLinkOptions> magicOptions,
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
        await NotifyAssigneesAsync(db, emailService, ticket, "assigned", magicOptions.Value.BaseUrl, token);
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

        var newStatus = request.Status.Trim().ToLower();
        var changed = !string.Equals(ticket.Status, newStatus, StringComparison.OrdinalIgnoreCase);
        ticket.Status = newStatus;
        ticket.UpdatedAt = DateTime.UtcNow;

        if (changed)
        {
            var actorName = await db.Users.AsNoTracking().Where(u => u.Id == accessor.Current.UserId)
                .Select(u => u.Name ?? u.Email).FirstOrDefaultAsync(token) ?? "Someone";
            var text = newStatus == "closed"
                ? $"{actorName} closed this ticket."
                : $"{actorName} reopened this ticket ({newStatus}).";
            AddTenantNotification(db, ticket, "support_status", ticket.Subject, text);
            MaybeAddPlatformNotification(db, ticket, "support_status", ticket.Subject, text);
        }

        await db.SaveChangesAsync(token);
        return Results.NoContent();
    }

    private static async Task<IResult> UpdatePriorityAsync(
        Guid id,
        PriorityRequest request,
        AppDbContext db,
        ITenantContextAccessor accessor,
        CancellationToken token)
    {
        var ticket = await db.SupportTickets.FirstOrDefaultAsync(t => t.Id == id && t.TenantId == accessor.Current.TenantId, token);
        if (ticket is null || !await CanAccessAsync(db, accessor, ticket, token))
        {
            return Results.NotFound();
        }

        if (!ValidPriorities.Contains(request.Priority?.Trim().ToLowerInvariant()))
        {
            return Results.BadRequest(new { error = "invalid_priority" });
        }

        ticket.Priority = request.Priority!.Trim().ToLowerInvariant();
        ticket.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(token);
        return Results.NoContent();
    }

    private static async Task<IResult> UploadAttachmentAsync(
        IFormFile file,
        AppDbContext db,
        ITenantContextAccessor accessor,
        IOptions<StorageOptions> storageOptions,
        CancellationToken token)
    {
        if (file is null || file.Length == 0)
        {
            return Results.BadRequest(new { error = "no_file" });
        }

        var tenantId = accessor.Current.TenantId;
        var root = string.IsNullOrWhiteSpace(storageOptions.Value.UploadsRoot) ? "/uploads" : storageOptions.Value.UploadsRoot;
        var dir = Path.Combine(root.TrimEnd(Path.DirectorySeparatorChar), tenantId.ToString(), "support");
        Directory.CreateDirectory(dir);

        var safeName = Path.GetFileName(file.FileName);
        var storedName = $"{Guid.NewGuid():N}-{safeName}";
        var destPath = Path.Combine(dir, storedName);
        await using (var stream = File.Create(destPath))
        {
            await file.CopyToAsync(stream, token);
        }

        var attachment = new SupportAttachment
        {
            TenantId = tenantId,
            FileName = safeName,
            MimeType = string.IsNullOrWhiteSpace(file.ContentType) ? null : file.ContentType,
            SizeBytes = file.Length,
            PathOrUrl = destPath,
            UploadedByUserId = accessor.Current.UserId
        };
        db.SupportAttachments.Add(attachment);
        await db.SaveChangesAsync(token);

        return Results.Ok(new
        {
            attachment.Id,
            attachment.FileName,
            attachment.MimeType,
            attachment.SizeBytes,
            Url = $"/api/support/attachments/{attachment.Id}/file"
        });
    }

    private static async Task<IResult> StreamAttachmentAsync(
        Guid id,
        AppDbContext db,
        ITenantContextAccessor accessor,
        HttpContext httpContext,
        CancellationToken token)
    {
        var attachment = await db.SupportAttachments.AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == id && a.TenantId == accessor.Current.TenantId, token);
        if (attachment is null || !File.Exists(attachment.PathOrUrl))
        {
            return Results.NotFound();
        }

        // Freshly uploaded, not-yet-attached files are only visible to the person who uploaded
        // them (the ticket/reply they belong to hasn't been submitted yet); once attached, normal
        // ticket access rules apply.
        if (attachment.TicketId is null)
        {
            if (attachment.UploadedByUserId != accessor.Current.UserId) return Results.NotFound();
        }
        else
        {
            var ticket = await db.SupportTickets.AsNoTracking()
                .FirstOrDefaultAsync(t => t.Id == attachment.TicketId.Value && t.TenantId == accessor.Current.TenantId, token);
            if (ticket is null || !await CanAccessAsync(db, accessor, ticket, token)) return Results.NotFound();
        }

        var contentType = attachment.MimeType;
        if (string.IsNullOrWhiteSpace(contentType) && !MimeProvider.TryGetContentType(attachment.FileName, out contentType))
        {
            contentType = "application/octet-stream";
        }

        var stream = File.OpenRead(attachment.PathOrUrl);
        httpContext.Response.Headers["Content-Disposition"] = $"inline; filename=\"{attachment.FileName}\"";
        httpContext.Response.Headers["X-Content-Type-Options"] = "nosniff";
        return Results.File(stream, contentType, enableRangeProcessing: true);
    }

    private static async Task NotifyAssigneesAsync(
        AppDbContext db,
        IEmailService emailService,
        SupportTicket ticket,
        string action,
        string baseUrl,
        CancellationToken token)
    {
        var recipientEmails = new List<string>();

        // Prefer explicit assignee
        if (ticket.AssignedToUserId is Guid userId)
        {
            var email = await db.Users.AsNoTracking()
                .Where(u => u.Id == userId)
                .Select(u => u.Email)
                .FirstOrDefaultAsync(token);
            if (!string.IsNullOrWhiteSpace(email))
            {
                recipientEmails.Add(email);
            }
        }

        // Fallback by role
        if (!recipientEmails.Any())
        {
            if (ticket.AssignedRole == "manager" && ticket.CreatedByUserId is Guid creatorId)
            {
                var inviterEmail = await db.Users.AsNoTracking()
                    .Where(u => u.Id == creatorId)
                    .Select(u => u.InvitedByUserId)
                    .Where(id => id.HasValue)
                    .Select(id => id!.Value)
                    .Join(db.Users.AsNoTracking(), id => id, u => u.Id, (id, u) => u.Email)
                    .FirstOrDefaultAsync(token);
                if (!string.IsNullOrWhiteSpace(inviterEmail))
                {
                    recipientEmails.Add(inviterEmail!);
                }
            }

            if (ticket.AssignedRole == "admin" || ticket.AssignedRole == "support" || !recipientEmails.Any())
            {
                var admins = await db.Users.AsNoTracking()
                    .Where(u => u.TenantId == ticket.TenantId &&
                                (u.Role.ToLower() == "admin" || u.Role.ToLower() == "superadmin") &&
                                (!u.IsDisabled))
                    .Select(u => u.Email)
                    .ToListAsync(token);
                recipientEmails.AddRange(admins.Where(e => !string.IsNullOrWhiteSpace(e))!);
            }
        }

        if (!recipientEmails.Any()) return;

        var creator = ticket.CreatedByUserId.HasValue
            ? await db.Users.AsNoTracking()
                .Where(u => u.Id == ticket.CreatedByUserId.Value)
                .Select(u => new { u.Name, u.Email })
                .FirstOrDefaultAsync(token)
            : null;

        var subjectLine = action == "created" ? "New support ticket" : "Support ticket assigned to you";
        var subject = $"{subjectLine}: {ticket.Subject}";
        var assignmentText = ticket.AssignedToUserId.HasValue
            ? await db.Users.AsNoTracking().Where(u => u.Id == ticket.AssignedToUserId.Value)
                .Select(u => u.Name ?? u.Email ?? "Unassigned").FirstOrDefaultAsync(token) ?? "Unassigned"
            : ticket.AssignedRole ?? "Unassigned";

        var (statusColor, statusBg) = ticket.Status switch
        {
            "closed" => ("#047857", "#d1fae5"),
            "pending" => ("#1d4ed8", "#dbeafe"),
            _ => ("#b45309", "#fef3c7")
        };
        var (priorityColor, priorityBg) = ticket.Priority switch
        {
            "urgent" => ("#be123c", "#ffe4e6"),
            "high" => ("#b45309", "#fef3c7"),
            "low" => ("#475569", "#f1f5f9"),
            _ => ("#1d4ed8", "#dbeafe")
        };
        var link = $"{baseUrl.TrimEnd('/')}/support";

        var bodyHtml = EmailLayout.Heading(WebUtility.HtmlEncode(ticket.Subject)) +
            EmailLayout.Paragraph(
                action == "created"
                    ? $"A new support ticket was submitted by <strong>{WebUtility.HtmlEncode(creator?.Name ?? creator?.Email ?? "someone")}</strong>."
                    : "A support ticket was assigned to you.") +
            EmailLayout.InfoBox(
                EmailLayout.InfoRow("Status", EmailLayout.Badge(WebUtility.HtmlEncode(ticket.Status), statusColor, statusBg)) +
                EmailLayout.InfoRow("Priority", EmailLayout.Badge(WebUtility.HtmlEncode(NormalizePriority(ticket.Priority)), priorityColor, priorityBg)) +
                EmailLayout.InfoRow("From", WebUtility.HtmlEncode(creator?.Name ?? creator?.Email ?? "Unknown")) +
                EmailLayout.InfoRow("Assigned to", WebUtility.HtmlEncode(assignmentText))) +
            EmailLayout.Paragraph("<strong>Description</strong>") +
            // ticket.Body is sanitized rich text HTML (RichTextSanitizer, applied at write time in
            // CreateAsync/ReplyAsync) - it's real markup meant to render, not text to escape, so
            // it's embedded directly rather than HtmlEncode'd like the plain-string fields above.
            $"""<div style="color:#334155;">{ticket.Body}</div>""" +
            EmailLayout.Button(link, "View ticket");

        var body = EmailLayout.Wrap(subject, bodyHtml);

        foreach (var email in recipientEmails.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            await emailService.SendAsync(email, subject, body, token);
        }
    }

    private static async Task<bool> CanAccessAsync(AppDbContext db, ITenantContextAccessor accessor, SupportTicket ticket, CancellationToken token)
    {
        var tenantId = accessor.Current.TenantId;
        if (ticket.TenantId != tenantId) return false;
        var userId = accessor.Current.UserId;

        if (IsAdmin(accessor))
        {
            if (ticket.AssignedRole == "admin" || ticket.AssignedToUserId == userId || ticket.CreatedByUserId == userId) return true;
            if (ticket.CreatedByUserId is Guid creatorId)
            {
                var invitedByAdmin = await db.Users.AsNoTracking()
                    .Where(u => u.Id == creatorId)
                    .Select(u => u.InvitedByUserId)
                    .FirstOrDefaultAsync(token);
                return invitedByAdmin == userId;
            }
            return false;
        }
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
