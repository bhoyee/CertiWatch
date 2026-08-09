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
    private static async Task<IResult> ExportCsvAsync(AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        if (!RecordVisibility.IsAdmin(accessor) && !RecordVisibility.IsManager(accessor))
        {
            return Results.Forbid();
        }

        var matrix = await BuildMatrixAsync(db, accessor.Current.TenantId, token);

        var csv = new StringBuilder();
        csv.Append("Staff,Job Title");
        foreach (var req in matrix.RequirementTypes)
        {
            csv.Append(',').Append(Escape(req.Name));
        }
        csv.AppendLine();

        foreach (var row in matrix.Rows)
        {
            csv.Append(Escape(row.StaffName)).Append(',').Append(Escape(row.JobTitle));
            foreach (var cell in row.Cells)
            {
                csv.Append(',').Append(Escape(CellText(cell)));
            }
            csv.AppendLine();
        }

        var bytes = Encoding.UTF8.GetBytes(csv.ToString());
        var fileName = $"compliance-export-{DateTime.UtcNow:yyyy-MM-dd}.csv";
        return Results.File(bytes, "text/csv", fileName);
    }

    private static async Task<IResult> ExportHtmlAsync(AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        if (!RecordVisibility.IsAdmin(accessor) && !RecordVisibility.IsManager(accessor))
        {
            return Results.Forbid();
        }

        var tenantId = accessor.Current.TenantId;
        var tenant = await db.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == tenantId, token);
        var matrix = await BuildMatrixAsync(db, tenantId, token);

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

    private static string CellText(ComplianceCellDto cell)
    {
        var label = cell.Status switch
        {
            "compliant" => "Compliant",
            "expiring" => "Expiring soon",
            "expired" => "Expired",
            _ => "Missing"
        };
        // Expiry date is only meaningful alongside expiring/expired - a "compliant" one-time
        // requirement has no renewal date worth printing, and "missing" has no date at all.
        if (cell.ExpiryDate.HasValue && (cell.Status == "expiring" || cell.Status == "expired"))
        {
            return $"{label} ({cell.ExpiryDate:yyyy-MM-dd})";
        }
        return label;
    }

    private static string Escape(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;
        var cleaned = value.Replace("\"", "\"\"");
        return cleaned.Contains(',') ? $"\"{cleaned}\"" : cleaned;
    }

    private static string BuildReportHtml(string tenantName, ComplianceMatrixDto matrix)
    {
        var sb = new StringBuilder();
        sb.Append("<!doctype html><html><head><meta charset=\"utf-8\">");
        sb.Append("<title>Compliance report - ").Append(System.Net.WebUtility.HtmlEncode(tenantName)).Append("</title>");
        sb.Append("""
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1e293b; margin: 32px; }
              h1 { font-size: 20px; margin: 0 0 4px; }
              .meta { color: #64748b; font-size: 13px; margin-bottom: 20px; }
              table { border-collapse: collapse; width: 100%; font-size: 12px; }
              th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; white-space: nowrap; }
              th { background: #f8fafc; text-transform: uppercase; font-size: 10px; letter-spacing: 0.04em; color: #475569; }
              tr:nth-child(even) td { background: #fafafa; }
              .compliant { color: #047857; }
              .expiring { color: #92400e; }
              .expired { color: #b91c1c; font-weight: 600; }
              .missing { color: #94a3b8; }
              .legend { margin-top: 16px; font-size: 12px; color: #64748b; }
              .legend span { margin-right: 16px; }
              .print-btn { margin-bottom: 16px; padding: 8px 14px; border-radius: 6px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; }
              @media print { .no-print { display: none; } body { margin: 0.5in; } }
            </style>
            """);
        sb.Append("</head><body>");
        sb.Append("<button class=\"print-btn no-print\" onclick=\"window.print()\">Print / Save as PDF</button>");
        sb.Append("<h1>Compliance report - ").Append(System.Net.WebUtility.HtmlEncode(tenantName)).Append("</h1>");
        sb.Append("<p class=\"meta\">Generated ").Append(DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm 'UTC'")).Append(" - ")
          .Append(matrix.Rows.Count).Append(" active staff, ").Append(matrix.RequirementTypes.Count).Append(" requirements.</p>");

        sb.Append("<table><thead><tr><th>Staff</th><th>Job title</th>");
        foreach (var req in matrix.RequirementTypes)
        {
            sb.Append("<th>").Append(System.Net.WebUtility.HtmlEncode(req.Name)).Append("</th>");
        }
        sb.Append("</tr></thead><tbody>");

        foreach (var row in matrix.Rows)
        {
            sb.Append("<tr><td>").Append(System.Net.WebUtility.HtmlEncode(row.StaffName)).Append("</td><td>")
              .Append(System.Net.WebUtility.HtmlEncode(row.JobTitle ?? "-")).Append("</td>");
            foreach (var cell in row.Cells)
            {
                sb.Append("<td class=\"").Append(cell.Status).Append("\">").Append(System.Net.WebUtility.HtmlEncode(CellText(cell))).Append("</td>");
            }
            sb.Append("</tr>");
        }

        sb.Append("</tbody></table>");
        sb.Append("<p class=\"legend\">");
        sb.Append("<span class=\"compliant\">&#9679; Compliant</span>");
        sb.Append("<span class=\"expiring\">&#9679; Expiring soon</span>");
        sb.Append("<span class=\"expired\">&#9679; Expired</span>");
        sb.Append("<span class=\"missing\">&#9679; Missing</span>");
        sb.Append("</p>");
        sb.Append("</body></html>");
        return sb.ToString();
    }
}
