using System.Text;
using CertiWatch.Api.Domain.Entities;
using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Infrastructure.Security;
using CertiWatch.Contracts.Dtos;
using CertiWatch.Contracts.Enums;
using Microsoft.AspNetCore.Mvc;
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
        return routes;
    }

    private static async Task<IResult> GetMatrixAsync(AppDbContext db, ITenantContextAccessor accessor, CancellationToken token)
    {
        if (!RecordVisibility.IsAdmin(accessor) && !RecordVisibility.IsManager(accessor))
        {
            return Results.Forbid();
        }

        var scope = await RecordVisibility.GetScopeAsync(db, accessor, token);
        var matrix = await BuildMatrixAsync(db, accessor.Current.TenantId, scope, token);
        return Results.Ok(matrix);
    }

    // Full snapshot by default - a dated audit document, not whatever happened to be on screen.
    // But when the admin has explicitly clicked a status filter or typed a search on the
    // Compliance page (e.g. "show me everyone Expired"), that same scope carries through to the
    // export on request - the point is to let them go from "here's a problem" to "here's a file
    // I can act on" in one step, not to silently ship a partial file. Either way the filter
    // actually applied is written into the file itself so it's never ambiguous what's missing.
    //
    // Shape: one row per (staff, requirement) pair - a flat compliance register, not a wide
    // staff-by-requirement cross-tab. A cross-tab gains a column every time a requirement type
    // is added and is unusable in Excel/print once a home has real headcount (a 20-staff home
    // times a growing requirement catalog stops fitting on a screen or a page long before that).
    // A flat list sorts/filters/pivots naturally in Excel and never gets wider - only longer,
    // which every spreadsheet tool handles fine. This is also the shape competitors' compliance
    // registers use, not a cross-tab.
    private static async Task<IResult> ExportCsvAsync(
        AppDbContext db,
        ITenantContextAccessor accessor,
        [FromQuery] string? status,
        [FromQuery] string? search,
        [FromQuery] string? requirement,
        CancellationToken token)
    {
        if (!RecordVisibility.IsAdmin(accessor) && !RecordVisibility.IsManager(accessor))
        {
            return Results.Forbid();
        }

        var tenantId = accessor.Current.TenantId;
        var tenant = await db.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == tenantId, token);
        var scope = await RecordVisibility.GetScopeAsync(db, accessor, token);
        var fullMatrix = await BuildMatrixAsync(db, tenantId, scope, token);
        var requirementName = ResolveRequirementName(fullMatrix, requirement);
        var matrix = FilterMatrix(fullMatrix, status, search, requirement);
        var tenantName = tenant?.Name ?? "CertiWatch";

        var csv = new StringBuilder();
        // A short metadata preamble (organisation, generated time, headcount) before the real
        // table - Excel/Sheets both render extra short rows above the header fine, and it's
        // what makes this read as a dated audit document rather than a bare data dump.
        csv.AppendLine("CertiWatch Compliance Export");
        csv.Append("Organisation,").AppendLine(Escape(tenantName));
        csv.Append("Generated,").AppendLine(DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm 'UTC'"));
        csv.Append("Filter,").AppendLine(Escape(DescribeFilter(status, search, requirementName)));
        csv.Append("Staff shown,").AppendLine(matrix.Rows.Count.ToString());
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
        var filterSuffix = string.IsNullOrWhiteSpace(status) ? "" : $"-{status}";
        var fileName = $"compliance-export{filterSuffix}-{DateTime.UtcNow:yyyy-MM-dd}.csv";
        return Results.File(bytes, "text/csv", fileName);
    }

    private static string? ResolveRequirementName(ComplianceMatrixDto matrix, string? requirement)
        => Guid.TryParse(requirement, out var id) ? matrix.RequirementTypes.FirstOrDefault(r => r.Id == id)?.Name : null;

    // Both export endpoints filter the SAME matrix that already powers the interactive page and
    // the unfiltered export - one status computation, reused everywhere, never recomputed
    // differently for "what you clicked" vs "what you downloaded".
    //
    // A selected requirement does two different jobs at once: (1) it narrows which staff rows
    // are included the same way status/search do, and (2) - unlike status/search - it also
    // narrows each remaining row's Cells down to just that one requirement. That second part
    // matters because status/search answer "who has a problem" (where seeing a person's whole
    // record is the point), while picking a requirement answers "who's done X specifically" -
    // a roster, where the other 13 unrelated requirements are just noise.
    private static ComplianceMatrixDto FilterMatrix(ComplianceMatrixDto matrix, string? status, string? search, string? requirement)
    {
        var normalizedStatus = status?.Trim().ToLowerInvariant();
        var validStatus = normalizedStatus is "compliant" or "expiring" or "expired" or "missing" ? normalizedStatus : null;
        var term = search?.Trim().ToLowerInvariant();
        var requirementId = Guid.TryParse(requirement, out var reqGuid) ? reqGuid : (Guid?)null;

        if (validStatus is null && string.IsNullOrEmpty(term) && requirementId is null)
        {
            return matrix;
        }

        var rows = matrix.Rows.Where(row =>
        {
            if (requirementId is not null)
            {
                var cell = row.Cells.FirstOrDefault(c => c.RequirementTypeId == requirementId);
                if (cell is null) return false;
                if (validStatus is not null && cell.Status != validStatus) return false;
            }
            else if (validStatus is not null && !row.Cells.Any(c => c.Status == validStatus))
            {
                return false;
            }

            if (!string.IsNullOrEmpty(term) &&
                !row.StaffName.ToLowerInvariant().Contains(term) &&
                !(row.JobTitle ?? "").ToLowerInvariant().Contains(term))
            {
                return false;
            }
            return true;
        }).ToList();

        if (requirementId is not null)
        {
            rows = rows.Select(row => row with { Cells = row.Cells.Where(c => c.RequirementTypeId == requirementId).ToList() }).ToList();
            var requirementTypes = matrix.RequirementTypes.Where(r => r.Id == requirementId).ToList();
            return new ComplianceMatrixDto(requirementTypes, rows);
        }

        return matrix with { Rows = rows };
    }

    private static string DescribeFilter(string? status, string? search, string? requirementName)
    {
        var normalizedStatus = status?.Trim().ToLowerInvariant();
        var validStatus = normalizedStatus is "compliant" or "expiring" or "expired" or "missing" ? normalizedStatus : null;
        var term = search?.Trim();

        var parts = new List<string>();
        if (!string.IsNullOrEmpty(requirementName)) parts.Add($"Requirement = {requirementName}");
        if (validStatus is not null) parts.Add($"Status = {StatusLabel(validStatus)}");
        if (!string.IsNullOrEmpty(term)) parts.Add($"Search = \"{term}\"");
        return parts.Count == 0 ? "None (full snapshot)" : string.Join("; ", parts);
    }

    private static async Task<ComplianceMatrixDto> BuildMatrixAsync(AppDbContext db, Guid tenantId, RecordVisibility.Scope? scope, CancellationToken token)
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
        var recordsQuery = db.Records.AsNoTracking()
            .Where(r => r.TenantId == tenantId && r.ProcessingStatus == ProcessingStatus.Ok);

        // A manager only sees the same records they'd see on Records/Review (their own uploads,
        // plus viewers they invited) - without this, a manager could see "Jordan is expired on
        // First Aid" here but have no way to open the actual record, since it belongs to a
        // colleague's upload they can't see anywhere else.
        var records = RecordVisibility.ApplyScope(recordsQuery, scope).ToList();

        // Staff rows are narrowed to match: a manager whose scope shows zero records for someone
        // would otherwise see that person as "missing" on every requirement, which reads as a far
        // bigger problem than reality - better to just not show a staff member at all than to
        // imply they have no compliance evidence when the truth is just "not in this manager's
        // scope".
        if (scope is not null)
        {
            var visibleStaffNames = records
                .Select(r => r.StaffName?.Trim())
                .Where(n => !string.IsNullOrWhiteSpace(n))
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
            activeStaff = activeStaff.Where(s => visibleStaffNames.Contains(s.Name.Trim())).ToList();
        }

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
        // A field starting with =, +, -, or @ executes as a formula when the export is opened
        // in Excel/Sheets - a leading apostrophe is the standard mitigation (forces text, and
        // spreadsheet apps hide it on display).
        if ("=+-@".IndexOf(cleaned[0]) >= 0)
        {
            cleaned = "'" + cleaned;
        }
        return cleaned.Contains(',') || cleaned.Contains('\n') ? $"\"{cleaned}\"" : cleaned;
    }

}
