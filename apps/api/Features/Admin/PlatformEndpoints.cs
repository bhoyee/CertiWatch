using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using System.Net.Sockets;
using CertiWatch.Api.Configuration;
using CertiWatch.Api.Infrastructure.Emails;
using CertiWatch.Api.Infrastructure.Services;
using System.Text.Json;
using Microsoft.Extensions.Options;
using Stripe;
using CertiWatch.Api.Features.Auth;

namespace CertiWatch.Api.Features.Admin;

public static class PlatformEndpoints
{
    public static IEndpointRouteBuilder MapPlatformEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/platform").RequireAuthorization("SuperAdmin");
        group.MapGet("/tenants", ListTenantsAsync);
        group.MapGet("/tenants/{id:guid}", GetTenantAsync);
        group.MapPost("/tenants/{id:guid}/suspend", SuspendTenantAsync);
        group.MapPost("/tenants/{id:guid}/resume", ResumeTenantAsync);
        group.MapPost("/tenants/{id:guid}/reset-subscription", ResetSubscriptionAsync);
        group.MapGet("/tenants/{id:guid}/api-keys", ListApiKeysAsync);
        group.MapPost("/tenants/{id:guid}/api-keys", CreateApiKeyAsync);
        group.MapPost("/api-keys/{keyId:guid}/revoke", RevokeApiKeyAsync);
        group.MapPost("/tenants/{tenantId:guid}/users/{userId:guid}/magic-link", SendMagicLinkAsync);
        group.MapPost("/tenants/{tenantId:guid}/users/{userId:guid}/disable", DisableUserAsync);
        group.MapPost("/tenants/{tenantId:guid}/users/{userId:guid}/enable", EnableUserAsync);
        group.MapPost("/tenants/{tenantId:guid}/users/{userId:guid}/force-reset", ForceResetAsync);
        group.MapGet("/support/tickets", ListSupportTicketsAsync);
        group.MapPost("/support/tickets/{id:guid}/status", UpdateSupportTicketAsync);
        group.MapGet("/billing/overview", BillingOverviewAsync);
        group.MapPost("/billing/invoices/{invoiceId}/resend", ResendInvoiceAsync);
        group.MapPost("/billing/subscriptions/{id}/cancel", CancelSubscriptionAsync);
        group.MapPost("/billing/subscriptions/{id}/pause", PauseSubscriptionAsync);
        group.MapPost("/billing/subscriptions/{id}/resume", ResumeSubscriptionAsync);
        group.MapPost("/billing/subscriptions/{id}/move-plan", MoveSubscriptionPlanAsync);
        group.MapPost("/billing/customers/{customerId}/credit", CreateCustomerCreditAsync);
        group.MapGet("/billing/subscriptions", ListSubscriptionsAsync);
        group.MapGet("/billing/invoices", ListInvoicesAsync);
        group.MapGet("/usage/overview", UsageOverviewAsync);
        group.MapGet("/audit/logs", ListAuditLogsAsync);
        group.MapGet("/audit/logins", ListLoginActivityAsync);
        return group;
    }

    private static Task EnsureApiKeysTableAsync(AppDbContext db, CancellationToken token) =>
        db.Database.ExecuteSqlRawAsync(
            """
            CREATE TABLE IF NOT EXISTS "ApiKeys"(
                "Id" uuid NOT NULL PRIMARY KEY,
                "TenantId" uuid NOT NULL,
                "Name" varchar(128) NOT NULL,
                "Key" varchar(256) NOT NULL,
                "IsRevoked" boolean NOT NULL DEFAULT false,
                "CreatedAt" timestamp without time zone NOT NULL,
                CONSTRAINT api_keys_key_unique UNIQUE("Key")
            );
            CREATE INDEX IF NOT EXISTS idx_apikeys_tenant_revoked ON "ApiKeys"("TenantId","IsRevoked");
            """,
            cancellationToken: token);

    private static async Task LogAuditAsync(AppDbContext db, Guid tenantId, ITenantContextAccessor accessor, string action, object meta, CancellationToken token)
    {
        db.AuditLogs.Add(new Domain.Entities.AuditLog
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            ActorId = accessor.Current.UserId,
            Action = action,
            MetaJson = JsonSerializer.Serialize(meta),
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync(token);
    }

    private static async Task<IResult> ListTenantsAsync(AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
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

        await EnsureApiKeysTableAsync(db, token);
        var apiKeys = await db.ApiKeys.AsNoTracking()
            .Where(k => k.TenantId == id)
            .OrderByDescending(k => k.CreatedAt)
            .Select(k => new { k.Id, k.Name, k.Key, k.IsRevoked, k.CreatedAt })
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
            ApiKeys = apiKeys,
            RecentRecords = recentRecords
        });
    }

    private static async Task<IResult> ListApiKeysAsync(Guid id, AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        await EnsureApiKeysTableAsync(db, token);
        var keys = await db.ApiKeys.AsNoTracking()
            .Where(k => k.TenantId == id)
            .OrderByDescending(k => k.CreatedAt)
            .Select(k => new { k.Id, k.Name, k.Key, k.IsRevoked, k.CreatedAt })
            .ToListAsync(token);
        return Results.Ok(keys);
    }

    private static async Task<IResult> CreateApiKeyAsync(
        Guid id,
        HttpContext http,
        AppDbContext db,
        ITenantContextAccessor accessor,
        CancellationToken token)
    {
        await EnsureApiKeysTableAsync(db, token);
        var body = await JsonSerializer.DeserializeAsync<Dictionary<string, string>>(http.Request.Body, cancellationToken: token) ?? new();
        var name = body.TryGetValue("name", out var n) ? n?.Trim() : string.Empty;
        if (string.IsNullOrWhiteSpace(name)) return Results.BadRequest(new { error = "Name is required" });

        var key = $"cw_{Guid.NewGuid():N}";
        var now = DateTime.UtcNow;
        db.ApiKeys.Add(new Domain.Entities.ApiKey
        {
            Id = Guid.NewGuid(),
            TenantId = id,
            Name = name,
            Key = key,
            IsRevoked = false,
            CreatedAt = now
        });
        await db.SaveChangesAsync(token);
        await LogAuditAsync(db, id, accessor, "platform_create_api_key", new { tenantId = id, name }, token);
        return Results.Ok(new { key });
    }

    private static async Task<IResult> RevokeApiKeyAsync(Guid keyId, AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        await EnsureApiKeysTableAsync(db, token);
        var key = await db.ApiKeys.FirstOrDefaultAsync(k => k.Id == keyId, token);
        if (key is null) return Results.NotFound();
        key.IsRevoked = true;
        await db.SaveChangesAsync(token);
        await LogAuditAsync(db, key.TenantId, accessor, "platform_revoke_api_key", new { keyId }, token);
        return Results.NoContent();
    }

    private static async Task<IResult> SuspendTenantAsync(Guid id, AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
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
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId && u.TenantId == tenantId, token);
        if (user is null) return Results.NotFound();

        var options = magicOptions.Value;
        var magicToken = MagicLinkTokenService.CreateToken(
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

    private static async Task<IResult> DisableUserAsync(
        Guid tenantId,
        Guid userId,
        AppDbContext db,
        ITenantContextAccessor accessor,
        CancellationToken token)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId && u.TenantId == tenantId, token);
        if (user is null) return Results.NotFound();

        user.IsDisabled = true;
        await db.SaveChangesAsync(token);
        await LogAuditAsync(db, tenantId, accessor, "platform_disable_user", new { tenantId, userId }, token);
        return Results.NoContent();
    }

    private static async Task<IResult> EnableUserAsync(
        Guid tenantId,
        Guid userId,
        AppDbContext db,
        ITenantContextAccessor accessor,
        CancellationToken token)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId && u.TenantId == tenantId, token);
        if (user is null) return Results.NotFound();

        user.IsDisabled = false;
        await db.SaveChangesAsync(token);
        await LogAuditAsync(db, tenantId, accessor, "platform_enable_user", new { tenantId, userId }, token);
        return Results.NoContent();
    }

    private static async Task<IResult> ForceResetAsync(
        Guid tenantId,
        Guid userId,
        AppDbContext db,
        ITenantContextAccessor accessor,
        IOptions<MagicLinkOptions> magicOptions,
        IEmailTemplateRenderer renderer,
        IEmailService emailService,
        CancellationToken token)
    {
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId && u.TenantId == tenantId, token);
        if (user is null) return Results.NotFound();

        var options = magicOptions.Value;
        var magicToken = MagicLinkTokenService.CreateToken(
            user.Email,
            tenantId,
            options.Secret,
            TimeSpan.FromMinutes(options.ExpiryMinutes),
            purpose: "magic",
            rememberDevice: false,
            deviceId: null);

        var link = $"{options.BaseUrl.TrimEnd('/')}/magic?token={magicToken}";
        var html = renderer.RenderMagicLink(user.Email, link);
        await emailService.SendAsync(user.Email, "Reset your CertiWatch access", html, token);

        await LogAuditAsync(db, tenantId, accessor, "platform_force_reset", new { tenantId, userId }, token);
        return Results.Ok(new { success = true });
    }

    private sealed record SupportTicketDto(
        Guid Id,
        Guid TenantId,
        string TenantName,
        string Subject,
        string Status,
        string AssignedRole,
        Guid? AssignedToUserId,
        string? AssignedToName,
        string? CreatedByName,
        DateTime CreatedAt,
        DateTime UpdatedAt);

    private static async Task<IResult> ListSupportTicketsAsync(
        AppDbContext db,
        ITenantContextAccessor accessor,
        Guid? tenantId,
        string? status,
        int? page,
        int? pageSize,
        CancellationToken token)
    {
        var query = db.SupportTickets.AsNoTracking().AsQueryable();
        if (tenantId.HasValue) query = query.Where(t => t.TenantId == tenantId.Value);
        if (!string.IsNullOrWhiteSpace(status))
        {
            var s = status.Trim().ToLower();
            query = query.Where(t => t.Status.ToLower() == s);
        }

        var size = Math.Clamp(pageSize ?? 25, 10, 100);
        var pageNumber = Math.Max(page ?? 1, 1);
        var skip = (pageNumber - 1) * size;

        var total = await query.CountAsync(token);

        var tickets = await query.OrderByDescending(t => t.UpdatedAt)
            .Skip(skip)
            .Take(size)
            .ToListAsync(token);

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
            string.IsNullOrWhiteSpace(t.AssignedRole) ? "unassigned" : t.AssignedRole!,
            t.AssignedToUserId,
            t.AssignedToUserId.HasValue && users.TryGetValue(t.AssignedToUserId.Value, out var an) ? an : null,
            t.CreatedByUserId.HasValue && users.TryGetValue(t.CreatedByUserId.Value, out var cn) ? cn : null,
            t.CreatedAt,
            t.UpdatedAt
        ));

        return Results.Ok(new { total, items = dto });
    }

    #region Billing overview/actions

    private sealed record BillingOverviewDto(
        int TotalSubscriptions,
        int Active,
        int PastDue,
        int Trialing,
        int Canceled,
        int TrialsExpiring,
        int CanceledLast30,
        decimal ChurnRate,
        decimal Mrr,
        decimal Arr,
        IEnumerable<object> UpcomingRenewals);

    private sealed record SubscriptionSummaryDto(
        string Id,
        string Status,
        DateTime? CurrentPeriodEnd,
        DateTime? TrialEnd,
        string? PriceId,
        decimal MonthlyAmount,
        string Currency,
        string? CustomerId,
        string TenantName,
        string? LastInvoiceId,
        bool CancelAtPeriodEnd);

    private sealed record InvoiceSummaryDto(
        string Id,
        string Status,
        decimal AmountDue,
        decimal AmountPaid,
        string Currency,
        string? SubscriptionId,
        string? CustomerId,
        string TenantName,
        DateTime Created,
        string? PdfUrl,
        string? HostedInvoiceUrl);

    private static decimal MonthlyAmount(SubscriptionItem item)
    {
        if (item.Price is null) return 0m;
        var amount = (item.Price.UnitAmountDecimal ?? 0m) / 100m;
        var qty = item.Quantity <= 0 ? 1L : item.Quantity;
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
        var opts = stripeOptions.Value;
        var subService = new SubscriptionService();

        // Fetch all subscriptions (beyond the 100 item Stripe limit) for accurate metrics
        var allSubs = new List<Subscription>();
        await foreach (var s in subService.ListAutoPagingAsync(new SubscriptionListOptions
        {
            Status = "all"
        }, cancellationToken: token))
        {
            allSubs.Add(s);
        }

        var subs = allSubs;
        var customerIds = subs
            .Where(s => !string.IsNullOrWhiteSpace(s.CustomerId))
            .Select(s => s.CustomerId!)
            .Distinct()
            .ToList();

        var tenantNames = await db.Tenants.AsNoTracking()
            .Where(t => !string.IsNullOrWhiteSpace(t.StripeCustomerId) && customerIds.Contains(t.StripeCustomerId!))
            .ToDictionaryAsync(t => t.StripeCustomerId!, t => t.Name, token);

        int CountStatus(string status) => subs.Count(s => string.Equals(s.Status, status, StringComparison.OrdinalIgnoreCase));
        var canceledLast30 = subs.Count(s =>
        {
            DateTime? canceled = s.CanceledAt;
            return canceled.HasValue && canceled.Value >= DateTime.UtcNow.AddDays(-30);
        });
        var churnRate = subs.Count > 0 ? Math.Round((decimal)canceledLast30 / subs.Count * 100m, 2) : 0m;
        var mrr = subs.Sum(s => s.Items?.Data?.Sum(MonthlyAmount) ?? 0m);
        var arr = mrr * 12m;
        var trialsExpiring = subs.Count(s =>
        {
            DateTime? trialEnd = s.TrialEnd;
            return trialEnd.HasValue && trialEnd.Value <= DateTime.UtcNow.AddDays(7);
        });

        var upcomingRenewals = subs
            .Where(s => s.Status == "active")
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
            CanceledLast30: canceledLast30,
            ChurnRate: churnRate,
            Mrr: decimal.Round(mrr, 2),
            Arr: decimal.Round(arr, 2),
            UpcomingRenewals: upcomingRenewals);

        return Results.Ok(dto);
    }

    private static async Task<IResult> ListSubscriptionsAsync(
        AppDbContext db,
        ITenantContextAccessor accessor,
        int? page,
        int? pageSize,
        CancellationToken token)
    {
        var subService = new SubscriptionService();

        // Fetch all, then page locally to allow >100 items
        var allSubs = new List<Subscription>();
        await foreach (var s in subService.ListAutoPagingAsync(new SubscriptionListOptions
        {
            Status = "all"
        }, cancellationToken: token))
        {
            allSubs.Add(s);
        }

        var size = Math.Clamp(pageSize ?? 100, 10, 200);
        var pageNumber = Math.Max(page ?? 1, 1);
        var skip = (pageNumber - 1) * size;

        var subs = allSubs.Skip(skip).Take(size).ToList();
        var customerIds = subs.Where(s => !string.IsNullOrWhiteSpace(s.CustomerId)).Select(s => s.CustomerId!).Distinct().ToList();
        var tenantNames = await db.Tenants.AsNoTracking()
            .Where(t => !string.IsNullOrWhiteSpace(t.StripeCustomerId) && customerIds.Contains(t.StripeCustomerId!))
            .ToDictionaryAsync(t => t.StripeCustomerId!, t => t.Name, token);

        var dtos = subs.Select(s =>
        {
            var items = s.Items?.Data ?? new List<SubscriptionItem>();
            var price = items.FirstOrDefault()?.Price;
            var amount = items.Sum(MonthlyAmount);
            var currency = price?.Currency?.ToUpperInvariant() ?? "USD";
            var lastInvoiceId = s.LatestInvoiceId;
            var tenantName = s.CustomerId != null && tenantNames.TryGetValue(s.CustomerId, out var tn) ? tn : "Unknown";

            return new SubscriptionSummaryDto(
                s.Id,
                s.Status ?? "unknown",
                s.CurrentPeriodEnd,
                s.TrialEnd,
                price?.Id,
                Math.Round(amount, 2),
                currency,
                s.CustomerId,
                tenantName,
                lastInvoiceId,
                s.CancelAtPeriodEnd == true);
        });

        return Results.Ok(new { total = allSubs.Count, items = dtos });
    }

    private static async Task<IResult> ListInvoicesAsync(
        AppDbContext db,
        ITenantContextAccessor accessor,
        int? page,
        int? pageSize,
        CancellationToken token)
    {
        var invoiceService = new InvoiceService();
        var allInvoices = new List<Invoice>();
        await foreach (var i in invoiceService.ListAutoPagingAsync(new InvoiceListOptions(), cancellationToken: token))
        {
            allInvoices.Add(i);
        }

        var size = Math.Clamp(pageSize ?? 100, 10, 200);
        var pageNumber = Math.Max(page ?? 1, 1);
        var skip = (pageNumber - 1) * size;

        var invoices = allInvoices.Skip(skip).Take(size).ToList();
        var customerIds = invoices.Where(i => !string.IsNullOrWhiteSpace(i.CustomerId)).Select(i => i.CustomerId!).Distinct().ToList();
        var tenantNames = await db.Tenants.AsNoTracking()
            .Where(t => !string.IsNullOrWhiteSpace(t.StripeCustomerId) && customerIds.Contains(t.StripeCustomerId!))
            .ToDictionaryAsync(t => t.StripeCustomerId!, t => t.Name, token);

        var dtos = invoices.Select(i => new InvoiceSummaryDto(
            i.Id,
            i.Status ?? "unknown",
            Math.Round(i.AmountDue / 100m, 2),
            Math.Round(i.AmountPaid / 100m, 2),
            (i.Currency ?? "usd").ToUpperInvariant(),
            i.SubscriptionId,
            i.CustomerId,
            i.CustomerId != null && tenantNames.TryGetValue(i.CustomerId, out var tn) ? tn : "Unknown",
            i.Created,
            i.InvoicePdf,
            i.HostedInvoiceUrl));

        return Results.Ok(new { total = allInvoices.Count, items = dtos });
    }

    private static async Task<IResult> ResendInvoiceAsync(
        string invoiceId,
        ITenantContextAccessor accessor,
        CancellationToken token)
    {
        var service = new InvoiceService();
        await service.SendInvoiceAsync(invoiceId, cancellationToken: token);
        return Results.NoContent();
    }

    private static async Task<IResult> CancelSubscriptionAsync(
        string id,
        ITenantContextAccessor accessor,
        CancellationToken token)
    {
        var service = new SubscriptionService();
        await service.UpdateAsync(id, new SubscriptionUpdateOptions { CancelAtPeriodEnd = true }, cancellationToken: token);
        return Results.NoContent();
    }

    private static async Task<IResult> PauseSubscriptionAsync(
        string id,
        ITenantContextAccessor accessor,
        CancellationToken token)
    {
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
        var svc = new CustomerBalanceTransactionService();
        await svc.CreateAsync(
            customerId,
            new CustomerBalanceTransactionCreateOptions
            {
                Amount = request.Amount,
                Currency = string.IsNullOrWhiteSpace(request.Currency) ? "usd" : request.Currency,
                Description = request.Description
            },
            cancellationToken: token);
        return Results.NoContent();
    }

    #endregion

    #region Usage / health

    private static async Task<IResult> UsageOverviewAsync(
        AppDbContext db,
        ITenantContextAccessor accessor,
        CancellationToken token)
    {
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

        var last7Pending = await db.Records.AsNoTracking()
            .Where(r => r.CreatedAt >= sevenDaysAgo && r.ProcessingStatus == CertiWatch.Contracts.Enums.ProcessingStatus.Pending)
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

        DateTime? lastProcessed = await db.Documents.AsNoTracking()
            .OrderByDescending(d => d.ProcessedAt ?? d.CreatedAt)
            .Select(d => (DateTime?)(d.ProcessedAt ?? d.CreatedAt))
            .FirstOrDefaultAsync(token);

        static string ProbeTcp(string host, int port, int timeoutMs = 1500)
        {
            try
            {
                using var client = new TcpClient();
                var task = client.ConnectAsync(host, port);
                var completed = task.Wait(timeoutMs);
                if (!completed) return "down";
                return client.Connected ? "ok" : "down";
            }
            catch
            {
                return "down";
            }
        }

        var redisHost = Environment.GetEnvironmentVariable("REDIS_HOST") ?? "redis";
        var redisPortEnv = Environment.GetEnvironmentVariable("REDIS_PORT");
        var redisPort = 6379;
        _ = int.TryParse(redisPortEnv, out redisPort);
        var redisStatus = ProbeTcp(redisHost, redisPort);

        var ocrHost = Environment.GetEnvironmentVariable("OCR_HOST") ?? "paddleocr";
        var ocrPortEnv = Environment.GetEnvironmentVariable("OCR_PORT");
        var ocrPort = 8000;
        _ = int.TryParse(ocrPortEnv, out ocrPort);
        var ocrStatus = ProbeTcp(ocrHost, ocrPort);

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
            Redis = redisStatus,
            Worker = lastProcessed.HasValue && lastProcessed.Value >= now.AddMinutes(-30) ? "ok" : "stale",
            Ocr = ocrStatus,
            QueueDepth = pendingRecords,
            QueueDepthTrend = last7Pending.Count == 0 ? new[] { pendingRecords } : last7Pending.Select(l => l.Count)
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

    private sealed record AuditLogDto(Guid Id, Guid TenantId, string TenantName, Guid? ActorId, string? ActorEmail, string Action, string? Meta, DateTime CreatedAt);

    private static async Task<IResult> ListAuditLogsAsync(
        AppDbContext db,
        ITenantContextAccessor accessor,
        Guid? tenantId,
        int? take,
        CancellationToken token)
    {
        var limit = Math.Clamp(take ?? 200, 20, 500);
        var query = db.AuditLogs.AsNoTracking();
        if (tenantId.HasValue) query = query.Where(a => a.TenantId == tenantId.Value);

        var logs = await query.OrderByDescending(a => a.CreatedAt).Take(limit).ToListAsync(token);
        var tenantNames = await db.Tenants.AsNoTracking()
            .Where(t => logs.Select(l => l.TenantId).Contains(t.Id))
            .ToDictionaryAsync(t => t.Id, t => t.Name, token);
        var userEmails = await db.Users.AsNoTracking()
            .Where(u => logs.Where(l => l.ActorId.HasValue).Select(l => l.ActorId!.Value).Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.Email, token);

        var dto = logs.Select(l => new AuditLogDto(
            l.Id,
            l.TenantId,
            tenantNames.TryGetValue(l.TenantId, out var tn) ? tn : "Unknown",
            l.ActorId,
            l.ActorId.HasValue && userEmails.TryGetValue(l.ActorId.Value, out var em) ? em : null,
            l.Action,
            l.MetaJson,
            l.CreatedAt));

        return Results.Ok(dto);
    }

    private static async Task<IResult> ListLoginActivityAsync(
        AppDbContext db,
        ITenantContextAccessor accessor,
        Guid? tenantId,
        int? take,
        CancellationToken token)
    {
        var limit = Math.Clamp(take ?? 200, 20, 500);

        var query = db.AuditLogs.AsNoTracking().Where(a => a.Action == "auth_login");
        if (tenantId.HasValue) query = query.Where(a => a.TenantId == tenantId.Value);

        var logs = await query.OrderByDescending(a => a.CreatedAt).Take(limit).ToListAsync(token);
        var tenantNames = await db.Tenants.AsNoTracking()
            .Where(t => logs.Select(l => l.TenantId).Contains(t.Id))
            .ToDictionaryAsync(t => t.Id, t => t.Name, token);
        var userEmails = await db.Users.AsNoTracking()
            .Where(u => logs.Where(l => l.ActorId.HasValue).Select(l => l.ActorId!.Value).Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.Email, token);

        var dto = logs.Select(l => new AuditLogDto(
            l.Id,
            l.TenantId,
            tenantNames.TryGetValue(l.TenantId, out var tn) ? tn : "Unknown",
            l.ActorId,
            l.ActorId.HasValue && userEmails.TryGetValue(l.ActorId.Value, out var em) ? em : null,
            l.Action,
            l.MetaJson,
            l.CreatedAt));

        return Results.Ok(dto);
    }

    #endregion

    #region Support actions

    private sealed record UpdateTicketRequest(string? Status, Guid? AssignedToUserId, string? AssignedRole, bool? Unassign);

    private static async Task<IResult> UpdateSupportTicketAsync(
        Guid id,
        UpdateTicketRequest request,
        AppDbContext db,
        ITenantContextAccessor accessor,
        IEmailService emailService,
        CancellationToken token)
    {
        var ticket = await db.SupportTickets.FirstOrDefaultAsync(t => t.Id == id, token);
        if (ticket is null) return Results.NotFound();

        var previousAssignee = ticket.AssignedToUserId;

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            ticket.Status = request.Status.Trim().ToLowerInvariant();
        }

        if (request.Unassign == true)
        {
            ticket.AssignedToUserId = null;
        }
        else if (request.AssignedToUserId.HasValue)
        {
            ticket.AssignedToUserId = request.AssignedToUserId;
        }

        if (!string.IsNullOrWhiteSpace(request.AssignedRole))
        {
            ticket.AssignedRole = request.AssignedRole.Trim().ToLowerInvariant();
        }

        ticket.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(token);
        await LogAuditAsync(
            db,
            ticket.TenantId,
            accessor,
            "platform_support_update",
            new
            {
                ticketId = id,
                request.Status,
                request.AssignedToUserId,
                request.AssignedRole,
                request.Unassign
            },
            token);

        if (ticket.AssignedToUserId.HasValue && ticket.AssignedToUserId != previousAssignee)
        {
            var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == ticket.AssignedToUserId.Value, token);
            if (user != null && !string.IsNullOrWhiteSpace(user.Email))
            {
                var html =
                    $"<p>Hello,</p><p>A support ticket was assigned to you.</p><p><strong>Subject:</strong> {System.Net.WebUtility.HtmlEncode(ticket.Subject)}</p><p>Status: {ticket.Status}</p><p>Tenant: {ticket.TenantId}</p>";
                await emailService.SendAsync(user.Email, "Support ticket assigned to you", html, token);
            }
        }

        return Results.NoContent();
    }

    #endregion
}
