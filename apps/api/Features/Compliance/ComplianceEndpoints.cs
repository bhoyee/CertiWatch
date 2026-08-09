using System.Text;
using CertiWatch.Api.Domain.Entities;
using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Infrastructure.Security;
using CertiWatch.Contracts.Dtos;
using CertiWatch.Contracts.Enums;
using Microsoft.EntityFrameworkCore;

namespace CertiWatch.Api.Features.Compliance;

// The screen that consumes Staff Directory + Requirement Types: a live-computed staff x
// requirement grid, not a persisted table. There's deliberately no RequirementAssignment
// entity behind this - every active StaffMember is checked against every active
// RequirementType (global + tenant), matching the roadmap's "default: everything applies to
// everyone" call. Matching Records to a (staff, requirement) pair is done the same
// crude-but-established way ReminderScheduler already matches CourseName - exact,
// case-insensitive, trimmed string equality - not a persisted foreign key.
public static class ComplianceEndpoints
{
    public static IEndpointRouteBuilder MapComplianceEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/api/compliance-matrix", GetMatrixAsync).RequireAuthorization();
        routes.MapGet("/api/compliance-matrix/export.csv", ExportCsvAsync).RequireAuthorization();
        routes.MapGet("/api/compliance-matrix/export.html", ExportHtmlAsync).RequireAuthorization();
        return routes;
    }

    private static async Task<IResult> GetMatrixAsync(AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        if (!RecordVisibility.IsAdmin(accessor) && !RecordVisibility.IsManager(accessor))
        {
            return Results.Forbid();
        }

        var matrix = await BuildMatrixAsync(db, accessor.Current.TenantId, token);
        return Results.Ok(matrix);
    }

    // The audit export is deliberately always the FULL matrix - unfiltered by whatever search
    // text or "only show gaps" toggle happens to be active on screen. It's a dated snapshot for
    // an inspector, not a view of whatever the admin was just looking at.
    //
    // Shape: one row per (staff, requirement) pair - a flat compliance register, not a wide
    // staff-by-requirement cross-tab. A cross-tab gains a column every time a requirement type
    // is added and is unusable in Excel/print once a home has real headcount (a 20-staff home
    // times a growing requirement catalog stops fitting on a screen or a page long before that).
    // A flat list sorts/filters/pivots naturally in Excel and never gets wider - only longer,
    // which every spreadsheet tool handles fine. This is also the shape competitors' compliance
    // registers use, not a cross-tab.
    private static async Task<IResult> ExportCsvAsync(AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        if (!RecordVisibility.IsAdmin(accessor) && !RecordVisibility.IsManager(accessor))
        {
            return Results.Forbid();
        }

        var tenantId = accessor.Current.TenantId;
        var tenant = await db.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == tenantId, token);
        var matrix = await BuildMatrixAsync(db, tenantId, token);
        var tenantName = tenant?.Name ?? "CertiWatch";

        var csv = new StringBuilder();
        // A short metadata preamble (organisation, generated time, headcount) before the real
        // table - Excel/Sheets both render extra short rows above the header fine, and it's
        // what makes this read as a dated audit document rather than a bare data dump.
        csv.AppendLine("CertiWatch Compliance Export");
        csv.Append("Organisation,").AppendLine(Escape(tenantName));
        csv.Append("Generated,").AppendLine(DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm 'UTC'"));
        csv.Append("Active staff,").AppendLine(matrix.Rows.Count.ToString());
        csv.Append("Requirements tracked,").AppendLine(matrix.RequirementTypes.Count.ToString());
        csv.AppendLine();
        csv.AppendLine("Staff Name,Job Title,Requirement,Status,Expiry Date,Renewal Period");

        var requirementById = matrix.RequirementTypes.ToDictionary(r => r.Id, r => r);
        foreach (var row in matrix.Rows)
        {
            foreach (var cell in row.Cells)
            {
                var req = requirementById[cell.RequirementTypeId];
                csv.Append(Escape(row.StaffName)).Append(',')
                   .Append(Escape(row.JobTitle)).Append(',')
                   .Append(Escape(req.Name)).Append(',')
                   .Append(Escape(StatusLabel(cell.Status))).Append(',')
                   .Append(cell.ExpiryDate?.ToString("yyyy-MM-dd") ?? string.Empty).Append(',')
                   .Append(Escape(RenewalPeriodText(req)));
                csv.AppendLine();
            }
        }

        var bytes = Encoding.UTF8.GetBytes(csv.ToString());
        var fileName = $"compliance-export-{DateTime.UtcNow:yyyy-MM-dd}.csv";
        return Results.File(bytes, "text/csv", fileName);
    }

    private static async Task<IResult> ExportHtmlAsync(HttpContext context, AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        if (!RecordVisibility.IsAdmin(accessor) && !RecordVisibility.IsManager(accessor))
        {
            return Results.Forbid();
        }

        var tenantId = accessor.Current.TenantId;
        var tenant = await db.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == tenantId, token);
        var matrix = await BuildMatrixAsync(db, tenantId, token);

        // The sitewide CSP (default-src 'self', set by SecurityHeaderExtensions in Program.cs)
        // has no style-src/script-src, so it silently blocks this report's inline <style> and
        // the print button's onclick - the report would render completely unstyled with a dead
        // button. Overriding it for just this response (self-generated content, every dynamic
        // value HTML-encoded below) rather than loosening the global policy.
        context.Response.Headers["Content-Security-Policy"] = "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'";

        var html = BuildReportHtml(tenant?.Name ?? "CertiWatch", matrix);
        return Results.Content(html, "text/html");
    }

    private static async Task<ComplianceMatrixDto> BuildMatrixAsync(AppDbContext db, Guid tenantId, CancellationToken token)
    {
        var activeStaff = await db.StaffMembers.AsNoTracking()
            .Where(s => s.TenantId == tenantId && s.IsActive)
            .OrderBy(s => s.Name)
            .ToListAsync(token);

        var requirementTypes = await db.RequirementTypes.AsNoTracking()
            .Where(r => r.TenantId == null || r.TenantId == tenantId)
            .OrderBy(r => r.Name)
            .ToListAsync(token);

        // Only accepted uploads count as evidence - NeedsReview/Pending/Failed records haven't
        // been confirmed yet, same distinction ReportsEndpoints.AnalyticsAsync already draws.
        var records = await db.Records.AsNoTracking()
            .Where(r => r.TenantId == tenantId && r.ProcessingStatus == ProcessingStatus.Ok)
            .ToListAsync(token);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var expiringThreshold = today.AddDays(30);

        var rows = activeStaff.Select(staff =>
        {
            var cells = requirementTypes.Select(req =>
            {
                var match = records
                    .Where(r => NamesMatch(r.StaffName, staff.Name) && NamesMatch(r.CourseName, req.Name))
                    .OrderByDescending(r => r.ExpiryDate ?? DateOnly.MinValue)
                    .ThenByDescending(r => r.IssueDate ?? DateOnly.MinValue)
                    .FirstOrDefault();

                var status = ComputeStatus(match, req.IsRenewable, today, expiringThreshold);
                return new ComplianceCellDto(req.Id, status, match?.ExpiryDate);
            }).ToList();

            return new ComplianceRowDto(staff.Id, staff.Name, staff.JobTitle, cells);
        }).ToList();

        var requirementDtos = requirementTypes
            .Select(r => new RequirementTypeDto(r.Id, r.TenantId, r.Name, r.DefaultValidityMonths, r.IsRenewable, r.IsGlobal))
            .ToList();

        return new ComplianceMatrixDto(requirementDtos, rows);
    }

    private static bool NamesMatch(string a, string b)
        => string.Equals(a?.Trim(), b?.Trim(), StringComparison.OrdinalIgnoreCase);

    private static string ComputeStatus(Record? match, bool isRenewable, DateOnly today, DateOnly expiringThreshold)
    {
        if (match is null)
        {
            return "missing";
        }

        // One-time requirements (Care Certificate, NVQs) are satisfied forever by any match -
        // there's nothing to renew, so any extracted expiry date on the record is irrelevant.
        if (!isRenewable)
        {
            return "compliant";
        }

        if (match.ExpiryDate is null)
        {
            // No extracted expiry isn't a gap here - it's correct for e.g. Right to Work on a
            // British/settled-status worker, whose document genuinely has no expiry to find.
            return "compliant";
        }

        if (match.ExpiryDate < today) return "expired";
        if (match.ExpiryDate <= expiringThreshold) return "expiring";
        return "compliant";
    }

    private static string StatusLabel(string status) => status switch
    {
        "compliant" => "Compliant",
        "expiring" => "Expiring soon",
        "expired" => "Expired",
        _ => "Missing"
    };

    // Mirrors the wording already established on the Requirements page: a renewable requirement
    // with no fixed DefaultValidityMonths (Right to Work) reads as "Varies per person" rather
    // than a specific cadence, since there genuinely isn't a universal one.
    private static string RenewalPeriodText(RequirementTypeDto req)
    {
        if (!req.IsRenewable) return "One-time";
        return req.DefaultValidityMonths.HasValue ? $"{req.DefaultValidityMonths} months" : "Varies per person";
    }

    private static string Escape(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;
        var cleaned = value.Replace("\"", "\"\"");
        return cleaned.Contains(',') || cleaned.Contains('\n') ? $"\"{cleaned}\"" : cleaned;
    }

    // A printed/PDF document is the wrong medium for row-level staff data at any real scale -
    // it belongs in something built for slicing large tables (the CSV export, or the on-screen
    // Compliance page, both already unbounded and searchable). This report is deliberately an
    // executive SUMMARY instead: it stays roughly the same length whether a home has 20 staff
    // or 2,000, because its size is bounded by the requirement catalog (one bar per requirement
    // type) and a fixed top-N urgent list, never by headcount.
    private static string BuildReportHtml(string tenantName, ComplianceMatrixDto matrix)
    {
        var encodedTenant = System.Net.WebUtility.HtmlEncode(tenantName);
        var totalStaff = matrix.Rows.Count;
        var compliantStaff = matrix.Rows.Count(r => r.Cells.All(c => c.Status == "compliant"));
        var gapStaff = totalStaff - compliantStaff;
        var totalGaps = matrix.Rows.Sum(r => r.Cells.Count(c => c.Status != "compliant"));

        var sb = new StringBuilder();
        sb.Append("<!doctype html><html><head><meta charset=\"utf-8\">");
        sb.Append("<title>Compliance report - ").Append(encodedTenant).Append("</title>");
        sb.Append("""
            <style>
              @page { margin: 1.5cm; }
              * { box-sizing: border-box; }
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1e293b; margin: 32px; }
              .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; }
              .brand .mark { width: 30px; height: 30px; border-radius: 8px; background: #2563eb; color: #fff; font-weight: 700;
                             font-size: 13px; display: flex; align-items: center; justify-content: center; }
              .brand .name { font-weight: 700; font-size: 15px; color: #0f172a; }
              h1 { font-size: 21px; margin: 0 0 4px; }
              .meta { color: #64748b; font-size: 13px; margin-bottom: 20px; }
              .summary { display: flex; gap: 12px; margin-bottom: 24px; }
              .stat { flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; }
              .stat .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; }
              .stat .value { font-size: 22px; font-weight: 700; color: #0f172a; }
              h2 { font-size: 15px; margin: 28px 0 4px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
              h2:first-of-type { border-top: none; padding-top: 0; }
              .sub { color: #64748b; font-size: 12px; margin: 0 0 12px; }
              table { border-collapse: collapse; width: 100%; font-size: 12px; }
              th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
              th { background: #f8fafc; text-transform: uppercase; font-size: 10px; letter-spacing: 0.04em; color: #475569; }
              tr:nth-child(even) td { background: #fafafa; }
              .compliant { color: #047857; }
              .expiring { color: #92400e; }
              .expired { color: #b91c1c; font-weight: 600; }
              .missing { color: #64748b; }
              .legend { margin-top: 16px; font-size: 12px; color: #64748b; }
              .legend span { margin-right: 16px; }
              .print-btn { margin-bottom: 16px; padding: 8px 14px; border-radius: 6px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; }
              .empty { color: #64748b; font-size: 13px; }
              .note { color: #64748b; font-size: 12px; margin-top: 8px; }
              .req-row { display: flex; align-items: center; gap: 10px; padding: 5px 0; page-break-inside: avoid; }
              .req-name { width: 220px; flex-shrink: 0; font-size: 12px; }
              .req-bar { flex: 1; height: 14px; border-radius: 4px; background: #f1f5f9; display: flex; overflow: hidden; }
              .req-pct { width: 110px; flex-shrink: 0; font-size: 11px; color: #64748b; text-align: right; }
              .overall-bar { height: 22px; border-radius: 6px; background: #f1f5f9; display: flex; overflow: hidden; margin-bottom: 14px; }
              /* Shared by both the per-requirement bars and the overall bar, not scoped to
                 either - a segment's color shouldn't depend on which bar it happens to be in. */
              .seg.compliant-seg { background: #10b981; }
              .seg.expiring-seg { background: #f59e0b; }
              .seg.expired-seg { background: #ef4444; }
              .seg.missing-seg { background: #cbd5e1; }
              .breakdown { display: flex; gap: 12px; }
              .breakdown .item { flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; }
              .breakdown .item .count { font-size: 20px; font-weight: 700; }
              .breakdown .item .pct { font-size: 12px; color: #64748b; }
              @media print { .no-print { display: none; } }
            </style>
            """);
        sb.Append("</head><body>");
        sb.Append("<button class=\"print-btn no-print\" onclick=\"window.print()\">Print / Save as PDF</button>");
        sb.Append("<div class=\"brand\"><span class=\"mark\">CW</span><span class=\"name\">CertiWatch</span></div>");
        sb.Append("<h1>Compliance Summary - ").Append(encodedTenant).Append("</h1>");
        sb.Append("<p class=\"meta\">Generated ").Append(DateTime.UtcNow.ToString("dd MMMM yyyy, HH:mm 'UTC'")).Append("</p>");

        sb.Append("<div class=\"summary\">");
        AppendStat(sb, "Active staff", totalStaff.ToString());
        AppendStat(sb, "Fully compliant", compliantStaff.ToString());
        AppendStat(sb, "Staff with gaps", gapStaff.ToString());
        AppendStat(sb, "Total gaps", totalGaps.ToString());
        sb.Append("</div>");

        // Org-wide totals across every tracked (staff, requirement) pair - pure counts, no
        // names. This is deliberately the last piece of staff-level content this report ever
        // had (an earlier version listed individual gaps here) - who specifically has what is
        // the on-screen Compliance page's job, not a static document's. Leads the report ahead
        // of the requirement breakdown - the single headline number before the detail.
        sb.Append("<h2>Overall status</h2>");
        sb.Append("<p class=\"sub\">Every active staff member against every requirement, combined.</p>");
        var allCells = matrix.Rows.SelectMany(r => r.Cells).ToList();
        var totalCells = allCells.Count;
        var compliantCells = allCells.Count(c => c.Status == "compliant");
        var expiringCells = allCells.Count(c => c.Status == "expiring");
        var expiredCells = allCells.Count(c => c.Status == "expired");
        var missingCells = allCells.Count(c => c.Status == "missing");

        if (totalCells == 0)
        {
            sb.Append("<p class=\"empty\">Nothing tracked yet.</p>");
        }
        else
        {
            double Pct(int n) => n * 100.0 / totalCells;
            sb.Append("<div class=\"overall-bar\">");
            if (compliantCells > 0) sb.Append("<div class=\"seg compliant-seg\" style=\"width:").Append(Pct(compliantCells).ToString("0.##")).Append("%\"></div>");
            if (expiringCells > 0) sb.Append("<div class=\"seg expiring-seg\" style=\"width:").Append(Pct(expiringCells).ToString("0.##")).Append("%\"></div>");
            if (expiredCells > 0) sb.Append("<div class=\"seg expired-seg\" style=\"width:").Append(Pct(expiredCells).ToString("0.##")).Append("%\"></div>");
            if (missingCells > 0) sb.Append("<div class=\"seg missing-seg\" style=\"width:").Append(Pct(missingCells).ToString("0.##")).Append("%\"></div>");
            sb.Append("</div>");

            sb.Append("<div class=\"breakdown\">");
            AppendBreakdownItem(sb, "compliant", "Compliant", compliantCells, Pct(compliantCells));
            AppendBreakdownItem(sb, "expiring", "Expiring soon", expiringCells, Pct(expiringCells));
            AppendBreakdownItem(sb, "expired", "Expired", expiredCells, Pct(expiredCells));
            AppendBreakdownItem(sb, "missing", "Missing", missingCells, Pct(missingCells));
            sb.Append("</div>");

            sb.Append("<p class=\"note\">").Append(totalCells).Append(" total checks across ").Append(totalStaff)
              .Append(" staff and ").Append(matrix.RequirementTypes.Count)
              .Append(" requirements. For which staff member has which gap, use the on-screen Compliance page (searchable and filterable) or the CSV export.</p>");
        }

        // One bar per requirement type - bounded by the size of the catalog, not by headcount.
        // Sorted worst-first (lowest compliance rate on top) so the biggest organisation-wide
        // problem is the first thing in this section.
        sb.Append("<h2>Compliance by requirement</h2>");
        sb.Append("<p class=\"sub\">Share of active staff compliant, expiring, or expired on each tracked requirement.</p>");
        var byRequirement = matrix.RequirementTypes
            .Select(req =>
            {
                var statuses = matrix.Rows.Select(row => row.Cells.First(c => c.RequirementTypeId == req.Id).Status).ToList();
                var compliant = statuses.Count(s => s == "compliant");
                var expiring = statuses.Count(s => s == "expiring");
                var expired = statuses.Count(s => s == "expired");
                return (Req: req, Compliant: compliant, Expiring: expiring, Expired: expired, Total: statuses.Count);
            })
            .OrderBy(x => x.Total == 0 ? 1.0 : (double)x.Compliant / x.Total)
            .ToList();

        if (totalStaff == 0)
        {
            sb.Append("<p class=\"empty\">No active staff yet.</p>");
        }
        else
        {
            foreach (var r in byRequirement)
            {
                var compliantPct = r.Total == 0 ? 0 : r.Compliant * 100.0 / r.Total;
                var expiringPct = r.Total == 0 ? 0 : r.Expiring * 100.0 / r.Total;
                var expiredPct = r.Total == 0 ? 0 : r.Expired * 100.0 / r.Total;
                sb.Append("<div class=\"req-row\"><div class=\"req-name\">").Append(System.Net.WebUtility.HtmlEncode(r.Req.Name)).Append("</div>");
                sb.Append("<div class=\"req-bar\">");
                if (compliantPct > 0) sb.Append("<div class=\"seg compliant-seg\" style=\"width:").Append(compliantPct.ToString("0.##")).Append("%\"></div>");
                if (expiringPct > 0) sb.Append("<div class=\"seg expiring-seg\" style=\"width:").Append(expiringPct.ToString("0.##")).Append("%\"></div>");
                if (expiredPct > 0) sb.Append("<div class=\"seg expired-seg\" style=\"width:").Append(expiredPct.ToString("0.##")).Append("%\"></div>");
                sb.Append("</div>");
                sb.Append("<div class=\"req-pct\">").Append(Math.Round(compliantPct)).Append("% compliant</div>");
                sb.Append("</div>");
            }
        }

        sb.Append("<p class=\"legend\">");
        sb.Append("<span class=\"compliant\">&#9679; Compliant</span>");
        sb.Append("<span class=\"expiring\">&#9679; Expiring soon</span>");
        sb.Append("<span class=\"expired\">&#9679; Expired</span>");
        sb.Append("<span class=\"missing\">&#9679; Missing</span>");
        sb.Append("</p>");
        sb.Append("</body></html>");
        return sb.ToString();
    }

    private static void AppendStat(StringBuilder sb, string label, string value)
    {
        sb.Append("<div class=\"stat\"><div class=\"label\">").Append(label)
          .Append("</div><div class=\"value\">").Append(value).Append("</div></div>");
    }

    private static void AppendBreakdownItem(StringBuilder sb, string statusClass, string label, int count, double pct)
    {
        sb.Append("<div class=\"item\"><div class=\"").Append(statusClass).Append(" count\">").Append(count)
          .Append("</div><div class=\"pct\">").Append(label).Append(" - ").Append(Math.Round(pct)).Append("%</div></div>");
    }
}
