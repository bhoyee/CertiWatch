using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using CertiWatch.Api.Configuration;
using CertiWatch.Api.Infrastructure.Emails;
using CertiWatch.Api.Infrastructure.Services;
using System.Text.Json;
using Microsoft.Extensions.Options;
using Stripe;

namespace CertiWatch.Api.Features.Admin;

public static class PlatformEndpoints
{
    public static IEndpointRouteBuilder MapPlatformEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/platform").RequireAuthorization();
        group.MapGet("/tenants", ListTenantsAsync);
        group.MapGet("/tenants/{id:guid}", GetTenantAsync);
        group.MapPost("/tenants/{id:guid}/suspend", SuspendTenantAsync);
        group.MapPost("/tenants/{id:guid}/resume", ResumeTenantAsync);
        group.MapPost("/tenants/{id:guid}/reset-subscription", ResetSubscriptionAsync);
        group.MapPost("/tenants/{tenantId:guid}/users/{userId:guid}/magic-link", SendMagicLinkAsync);
        group.MapGet("/support/tickets", ListSupportTicketsAsync);
        group.MapPost("/support/tickets/{id:guid}/status", UpdateSupportTicketAsync);
        group.MapGet("/billing/overview", BillingOverviewAsync);
        group.MapPost("/billing/invoices/{invoiceId}/resend", ResendInvoiceAsync);
        group.MapPost("/billing/subscriptions/{id}/cancel", CancelSubscriptionAsync);
        group.MapPost("/billing/subscriptions/{id}/pause", PauseSubscriptionAsync);
        group.MapPost("/billing/subscriptions/{id}/resume", ResumeSubscriptionAsync);
        group.MapPost("/billing/subscriptions/{id}/move-plan", MoveSubscriptionPlanAsync);
        group.MapPost("/billing/customers/{customerId}/credit", CreateCustomerCreditAsync);
        group.MapGet("/usage/overview", UsageOverviewAsync);
        return group;
    }

    private static bool IsSuperAdmin(ITenantContextAccessor accessor) =>
        string.Equals(accessor.Current.Role, "superadmin", StringComparison.OrdinalIgnoreCase);

    private static async Task LogAuditAsync(AppDbContext db, Guid tenantId, ITenantContextAccessor accessor, string action, object meta, CancellationToken token)
    {
        db.AuditLogs.Add(new Domain.Entities.AuditLog
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            ActorId = accessor.Current.UserId,
            Action = action,
            MetaJson = JsonSerializer.Serialize(meta),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync(token);
    }

    private static async Task<IResult> ListTenantsAsync(AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        if (!IsSuperAdmin(accessor)) return Results.Forbid();

        var tenants = await db.Tenants.AsNoTracking().OrderBy(t => t.CreatedAtUtc).ToListAsync(token);

        var recordCounts = await db.Records.AsNoTracking()
            .GroupBy(r => r.TenantId)
            .Select(g => new { TenantId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.TenantId, x => x.Count, token);

        var userCounts = await db.Users.AsNoTracking()
            .GroupBy(u => u.TenantId)
            .Select(g => new { TenantId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.TenantId, x => x.Count, token);

        var result = tenants.Select(t => new
        {
            t.Id,
            t.Name,
            t.Plan,
            t.CreatedAtUtc,
            t.SubscriptionStatus,
            t.CurrentPeriodEndUtc,
            t.StripeCustomerId,
            t.StripeSubscriptionId,
            RecordCount = recordCounts.TryGetValue(t.Id, out var rc) ? rc : 0,
            UserCount = userCounts.TryGetValue(t.Id, out var uc) ? uc : 0
        });

        return Results.Ok(result);
    }

    private static async Task<IResult> GetTenantAsync(Guid id, AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        if (!IsSuperAdmin(accessor)) return Results.Forbid();

        var tenant = await db.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id, token);
        if (tenant is null) return Results.NotFound();

        var recordCount = await db.Records.AsNoTracking().CountAsync(r => r.TenantId == id, token);
        var userCount = await db.Users.AsNoTracking().CountAsync(u => u.TenantId == id, token);
        var deviceCount = await db.Devices.AsNoTracking().CountAsync(d => d.TenantId == id, token);
        var sourceCount = await db.Sources.AsNoTracking().CountAsync(s => s.TenantId == id, token);

        var users = await db.Users.AsNoTracking()
            .Where(u => u.TenantId == id)
            .OrderBy(u => u.CreatedAt)
            .Select(u => new { u.Id, u.Email, u.Name, u.Role, u.IsDisabled, u.CreatedAt })
            .ToListAsync(token);

        var devices = await db.Devices.AsNoTracking()
            .Where(d => d.TenantId == id)
            .OrderByDescending(d => d.CreatedAt)
            .Take(20)
            .Select(d => new { d.Id, d.Name, d.Status, d.CreatedAt, d.LastSeenAt })
            .ToListAsync(token);

        var sources = await db.Sources.AsNoTracking()
            .Where(s => s.TenantId == id)
            .OrderByDescending(s => s.CreatedAt)
            .Take(20)
            .Select(s => new { s.Id, s.DisplayName, s.Type, s.CreatedAt })
            .ToListAsync(token);

        var recentRecords = await db.Records.AsNoTracking()
            .Where(r => r.TenantId == id)
            .OrderByDescending(r => r.CreatedAt)
            .Take(15)
            .Select(r => new { r.Id, r.StaffName, r.CourseName, r.Issuer, r.ProcessingStatus, r.CreatedAt })
            .ToListAsync(token);

        return Results.Ok(new
        {
            tenant.Id,
            tenant.Name,
            tenant.Plan,
            tenant.CreatedAtUtc,
            tenant.SubscriptionStatus,
            tenant.CurrentPeriodEndUtc,
            tenant.StripeCustomerId,
            tenant.StripeSubscriptionId,
            tenant.BillingEmail,
            RecordCount = recordCount,
            UserCount = userCount,
            DeviceCount = deviceCount,
            SourceCount = sourceCount,
            Users = users,
            Devices = devices,
            Sources = sources,
            RecentRecords = recentRecords
        });
    }

    private static async Task<IResult> SuspendTenantAsync(Guid id, AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        if (!IsSuperAdmin(accessor)) return Results.Forbid();

        var tenant = await db.Tenants.FirstOrDefaultAsync(t => t.Id == id, token);
        if (tenant is null) return Results.NotFound();

        tenant.SubscriptionStatus = "suspended";
        await db.Users.Where(u => u.TenantId == id).ExecuteUpdateAsync(s => s.SetProperty(x => x.IsDisabled, true), token);
        await db.SaveChangesAsync(token);
        await LogAuditAsync(db, id, accessor, "platform_suspend_tenant", new { tenantId = id }, token);

        return Results.NoContent();
    }

    private static async Task<IResult> ResumeTenantAsync(Guid id, AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        if (!IsSuperAdmin(accessor)) return Results.Forbid();

        var tenant = await db.Tenants.FirstOrDefaultAsync(t => t.Id == id, token);
        if (tenant is null) return Results.NotFound();

        tenant.SubscriptionStatus = "active";
        await db.Users.Where(u => u.TenantId == id).ExecuteUpdateAsync(s => s.SetProperty(x => x.IsDisabled, false), token);
        await db.SaveChangesAsync(token);
        await LogAuditAsync(db, id, accessor, "platform_resume_tenant", new { tenantId = id }, token);

        return Results.NoContent();
    }

    private static async Task<IResult> ResetSubscriptionAsync(Guid id, AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        if (!IsSuperAdmin(accessor)) return Results.Forbid();
        var tenant = await db.Tenants.FirstOrDefaultAsync(t => t.Id == id, token);
        if (tenant is null) return Results.NotFound();
        tenant.SubscriptionStatus = null;
        tenant.CurrentPeriodEndUtc = null;
        await db.SaveChangesAsync(token);
        await LogAuditAsync(db, id, accessor, "platform_reset_subscription", new { tenantId = id }, token);
        return Results.NoContent();
    }

    private static async Task<IResult> SendMagicLinkAsync(
        Guid tenantId,
        Guid userId,
        AppDbContext db,
        ITenantContextAccessor accessor,
        IOptions<MagicLinkOptions> magicOptions,
        IEmailTemplateRenderer renderer,
        IEmailService emailService,
        CancellationToken token)
    {
        if (!IsSuperAdmin(accessor)) return Results.Forbid();

        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId && u.TenantId == tenantId, token);
        if (user is null) return Results.NotFound();

        var options = magicOptions.Value;
        var magicToken = Infrastructure.Security.MagicLinkTokenService.CreateToken(
            user.Email,
            tenantId,
            options.Secret,
            TimeSpan.FromMinutes(options.ExpiryMinutes),
            purpose: "magic",
            rememberDevice: false,
            deviceId: null);

        var link = $"{options.BaseUrl.TrimEnd('/')}/magic?token={magicToken}";
        var html = renderer.RenderMagicLink(user.Email, link);
        await emailService.SendAsync(user.Email, "Your CertiWatch login link", html, token);

        await LogAuditAsync(db, tenantId, accessor, "platform_force_magic_link", new { tenantId, userId }, token);
        return Results.Ok(new { success = true });
    }

    private sealed record SupportTicketDto(
        Guid Id,
        Guid TenantId,
        string TenantName,
        string Subject,
        string Status,
        string AssignedRole,
        string? AssignedToName,
        string? CreatedByName,
        DateTime CreatedAt,
        DateTime UpdatedAt);

    private static async Task<IResult> ListSupportTicketsAsync(
        AppDbContext db,
        ITenantContextAccessor accessor,
        Guid? tenantId,
        string? status,
        CancellationToken token)
    {
        if (!IsSuperAdmin(accessor)) return Results.Forbid();

        var query = db.SupportTickets.AsNoTracking().AsQueryable();
        if (tenantId.HasValue) query = query.Where(t => t.TenantId == tenantId.Value);
        if (!string.IsNullOrWhiteSpace(status))
        {
            var s = status.Trim().ToLower();
            query = query.Where(t => t.Status.ToLower() == s);
        }

        var tickets = await query.OrderByDescending(t => t.UpdatedAt).Take(300).ToListAsync(token);

        var tenantIds = tickets.Select(t => t.TenantId).Distinct().ToList();
        var tenants = await db.Tenants.AsNoTracking()
            .Where(t => tenantIds.Contains(t.Id))
            .ToDictionaryAsync(t => t.Id, t => t.Name, token);

        var userIds = tickets
            .SelectMany(t => new[] { t.AssignedToUserId, t.CreatedByUserId }.Where(x => x.HasValue).Select(x => x!.Value))
            .Distinct()
            .ToList();
        var users = await db.Users.AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.Name ?? u.Email, token);

        var dto = tickets.Select(t => new SupportTicketDto(
            t.Id,
            t.TenantId,
            tenants.TryGetValue(t.TenantId, out var tn) ? tn : "Unknown",
            t.Subject,
            t.Status,
            t.AssignedRole,
            t.AssignedToUserId.HasValue && users.TryGetValue(t.AssignedToUserId.Value, out var an) ? an : null,
            t.CreatedByUserId.HasValue && users.TryGetValue(t.CreatedByUserId.Value, out var cn) ? cn : null,
            t.CreatedAt,
            t.UpdatedAt
        ));

        return Results.Ok(dto);
    }

    #region Billing overview/actions

    private sealed record BillingOverviewDto(
        int TotalSubscriptions,
        int Active,
        int PastDue,
        int Trialing,
        int Canceled,
        int TrialsExpiring,
        decimal Mrr,
        decimal Arr,
        IEnumerable<object> UpcomingRenewals);

    private static decimal MonthlyAmount(SubscriptionItem item)
    {
        if (item.Price is null) return 0m;
        var amount = (item.Price.UnitAmountDecimal ?? 0m) / 100m;
        var qty = item.Quantity ?? 1;
        var interval = item.Price.Recurring?.Interval ?? "month";
        var subtotal = amount * qty;
        return interval switch
        {
            "year" => subtotal / 12m,
            _ => subtotal
        };
    }

    private static async Task<IResult> BillingOverviewAsync(
        AppDbContext db,
        ITenantContextAccessor accessor,
        IOptions<StripeOptions> stripeOptions,
        CancellationToken token)
    {
        if (!IsSuperAdmin(accessor)) return Results.Forbid();

        var opts = stripeOptions.Value;
        var subService = new SubscriptionService();
        var list = await subService.ListAsync(new SubscriptionListOptions
        {
            Status = "all",
            Limit = 100
        }, cancellationToken: token);

        var subs = list.Data ?? new List<Subscription>();
        var customerIds = subs
            .Where(s => !string.IsNullOrWhiteSpace(s.CustomerId))
            .Select(s => s.CustomerId!)
            .Distinct()
            .ToList();

        var tenantNames = await db.Tenants.AsNoTracking()
            .Where(t => !string.IsNullOrWhiteSpace(t.StripeCustomerId) && customerIds.Contains(t.StripeCustomerId!))
            .ToDictionaryAsync(t => t.StripeCustomerId!, t => t.Name, token);

        int CountStatus(string status) => subs.Count(s => string.Equals(s.Status, status, StringComparison.OrdinalIgnoreCase));
        var mrr = subs.Sum(s => s.Items?.Data?.Sum(MonthlyAmount) ?? 0m);
        var arr = mrr * 12m;
        var trialsExpiring = subs.Count(s => s.TrialEnd.HasValue && s.TrialEnd.Value <= DateTime.UtcNow.AddDays(7));

        var upcomingRenewals = subs
            .Where(s => s.Status == "active" && s.CurrentPeriodEnd.HasValue)
            .OrderBy(s => s.CurrentPeriodEnd)
            .Take(10)
            .Select(s => new
            {
                s.Id,
                s.Status,
                RenewOn = s.CurrentPeriodEnd,
                TenantName = s.CustomerId != null && tenantNames.TryGetValue(s.CustomerId, out var tn) ? tn : "Unknown"
            });

        var dto = new BillingOverviewDto(
            TotalSubscriptions: subs.Count,
            Active: CountStatus("active"),
            PastDue: CountStatus("past_due"),
            Trialing: CountStatus("trialing"),
            Canceled: CountStatus("canceled"),
            TrialsExpiring: trialsExpiring,
            Mrr: decimal.Round(mrr, 2),
            Arr: decimal.Round(arr, 2),
            UpcomingRenewals: upcomingRenewals);

        return Results.Ok(dto);
    }

    private static async Task<IResult> ResendInvoiceAsync(
        string invoiceId,
        ITenantContextAccessor accessor,
        CancellationToken token)
    {
        if (!IsSuperAdmin(accessor)) return Results.Forbid();
        var service = new InvoiceService();
        await service.SendInvoiceAsync(invoiceId, cancellationToken: token);
        return Results.NoContent();
    }

    private static async Task<IResult> CancelSubscriptionAsync(
        string id,
        ITenantContextAccessor accessor,
        CancellationToken token)
    {
        if (!IsSuperAdmin(accessor)) return Results.Forbid();
        var service = new SubscriptionService();
        await service.UpdateAsync(id, new SubscriptionUpdateOptions { CancelAtPeriodEnd = true }, cancellationToken: token);
        return Results.NoContent();
    }

    private static async Task<IResult> PauseSubscriptionAsync(
        string id,
        ITenantContextAccessor accessor,
        CancellationToken token)
    {
        if (!IsSuperAdmin(accessor)) return Results.Forbid();
        var service = new SubscriptionService();
        await service.UpdateAsync(id, new SubscriptionUpdateOptions
        {
            PauseCollection = new SubscriptionPauseCollectionOptions { Behavior = "mark_uncollectible" }
        }, cancellationToken: token);
        return Results.NoContent();
    }

    private static async Task<IResult> ResumeSubscriptionAsync(
        string id,
        ITenantContextAccessor accessor,
        CancellationToken token)
    {
        if (!IsSuperAdmin(accessor)) return Results.Forbid();
        var service = new SubscriptionService();
        await service.UpdateAsync(id, new SubscriptionUpdateOptions
        {
            CancelAtPeriodEnd = false,
            PauseCollection = null
        }, cancellationToken: token);
        return Results.NoContent();
    }

    private sealed record MovePlanRequest(string PriceId);

    private static async Task<IResult> MoveSubscriptionPlanAsync(
        string id,
        MovePlanRequest request,
        ITenantContextAccessor accessor,
        CancellationToken token)
    {
        if (!IsSuperAdmin(accessor)) return Results.Forbid();
        if (string.IsNullOrWhiteSpace(request.PriceId)) return Results.BadRequest(new { error = "missing_price" });
        var service = new SubscriptionService();
        var subscription = await service.GetAsync(id, cancellationToken: token);
        var firstItem = subscription.Items.Data.FirstOrDefault();
        if (firstItem is null) return Results.BadRequest(new { error = "no_items" });

        var update = new SubscriptionUpdateOptions
        {
            Items = new List<SubscriptionItemOptions>
            {
                new()
                {
                    Id = firstItem.Id,
                    Price = request.PriceId
                }
            }
        };
        await service.UpdateAsync(id, update, cancellationToken: token);
        return Results.NoContent();
    }

    private sealed record CreditRequest(long Amount, string Currency, string? Description);

    private static async Task<IResult> CreateCustomerCreditAsync(
        string customerId,
        CreditRequest request,
        ITenantContextAccessor accessor,
        CancellationToken token)
    {
        if (!IsSuperAdmin(accessor)) return Results.Forbid();
        var svc = new CustomerBalanceTransactionService();
        await svc.CreateAsync(new CustomerBalanceTransactionCreateOptions
        {
            Customer = customerId,
            Amount = request.Amount,
            Currency = string.IsNullOrWhiteSpace(request.Currency) ? "usd" : request.Currency,
            Description = request.Description
        }, cancellationToken: token);
        return Results.NoContent();
    }

    #endregion

    #region Usage / health

    private static async Task<IResult> UsageOverviewAsync(
        AppDbContext db,
        ITenantContextAccessor accessor,
        CancellationToken token)
    {
        if (!IsSuperAdmin(accessor)) return Results.Forbid();

        var now = DateTime.UtcNow;
        var sevenDaysAgo = now.Date.AddDays(-6);

        var totalRecords = await db.Records.CountAsync(token);
        var needsReview = await db.Records.CountAsync(r => r.ProcessingStatus == CertiWatch.Contracts.Enums.ProcessingStatus.NeedsReview, token);
        var okRecords = await db.Records.CountAsync(r => r.ProcessingStatus == CertiWatch.Contracts.Enums.ProcessingStatus.Ok, token);
        var pendingRecords = await db.Records.CountAsync(r => r.ProcessingStatus == CertiWatch.Contracts.Enums.ProcessingStatus.Pending, token);

        var last7 = await db.Records.AsNoTracking()
            .Where(r => r.CreatedAt >= sevenDaysAgo)
            .GroupBy(r => r.CreatedAt.Date)
            .Select(g => new { Date = g.Key, Count = g.Count() })
            .OrderBy(g => g.Date)
            .ToListAsync(token);

        var perTenant = await db.Records.AsNoTracking()
            .GroupBy(r => r.TenantId)
            .Select(g => new
            {
                TenantId = g.Key,
                Total = g.Count(),
                NeedsReview = g.Count(r => r.ProcessingStatus == CertiWatch.Contracts.Enums.ProcessingStatus.NeedsReview)
            })
            .OrderByDescending(g => g.Total)
            .Take(10)
            .ToListAsync(token);

        var tenantIds = perTenant.Select(p => p.TenantId).ToList();
        var tenantNames = await db.Tenants.AsNoTracking()
            .Where(t => tenantIds.Contains(t.Id))
            .ToDictionaryAsync(t => t.Id, t => t.Name, token);

        var lastProcessed = await db.Documents.AsNoTracking()
            .OrderByDescending(d => d.ProcessedAt ?? d.CreatedAt)
            .Select(d => d.ProcessedAt ?? d.CreatedAt)
            .FirstOrDefaultAsync(token);

        string postgresStatus;
        try
        {
            var canConnect = await db.Database.CanConnectAsync(token);
            postgresStatus = canConnect ? "ok" : "down";
        }
        catch
        {
            postgresStatus = "down";
        }

        var health = new
        {
            Postgres = postgresStatus,
            Redis = "unknown", // No live Redis probe wired; can be enhanced with a ping if a client is registered.
            Worker = lastProcessed.HasValue && lastProcessed.Value >= now.AddMinutes(-30) ? "ok" : "stale",
            Ocr = lastProcessed.HasValue && lastProcessed.Value >= now.AddMinutes(-30) ? "ok" : "unknown",
            QueueDepth = pendingRecords,
            QueueDepthTrend = last7.Select(l => l.Count)
        };

        var dto = new
        {
            TotalRecords = totalRecords,
            NeedsReview = needsReview,
            OkRecords = okRecords,
            PendingRecords = pendingRecords,
            Last7Days = last7.Select(l => new { date = l.Date, count = l.Count }),
            TopTenants = perTenant.Select(p => new
            {
                p.TenantId,
                Name = tenantNames.TryGetValue(p.TenantId, out var n) ? n : "Unknown",
                p.Total,
                p.NeedsReview
            }),
            Health = health
        };

        return Results.Ok(dto);
    }

    #endregion

    #region Support actions

    private sealed record UpdateTicketRequest(string? Status, Guid? AssignedToUserId);

    private static async Task<IResult> UpdateSupportTicketAsync(
        Guid id,
        UpdateTicketRequest request,
        AppDbContext db,
        ITenantContextAccessor accessor,
        CancellationToken token)
    {
        if (!IsSuperAdmin(accessor)) return Results.Forbid();
        var ticket = await db.SupportTickets.FirstOrDefaultAsync(t => t.Id == id, token);
        if (ticket is null) return Results.NotFound();

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            ticket.Status = request.Status.Trim().ToLowerInvariant();
        }

        if (request.AssignedToUserId.HasValue)
        {
            ticket.AssignedToUserId = request.AssignedToUserId;
        }

        ticket.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(token);
        await LogAuditAsync(db, ticket.TenantId, accessor, "platform_support_update", new { ticketId = id, request.Status, request.AssignedToUserId }, token);

        return Results.NoContent();
    }

    #endregion
}
