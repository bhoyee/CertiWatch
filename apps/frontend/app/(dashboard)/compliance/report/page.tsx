"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { fetchJson } from "../../../../lib/api";

type Status = "compliant" | "expiring" | "expired" | "missing";

type RequirementTypeDto = {
  id: string;
  tenantId: string | null;
  name: string;
  defaultValidityMonths: number | null;
  isRenewable: boolean;
  isGlobal: boolean;
};

type ComplianceCellDto = { requirementTypeId: string; status: Status; expiryDate: string | null };
type ComplianceRowDto = { staffId: string; staffName: string; jobTitle: string | null; cells: ComplianceCellDto[] };
type ComplianceMatrixDto = { requirementTypes: RequirementTypeDto[]; rows: ComplianceRowDto[] };

const STATUS_LABEL: Record<Status, string> = {
  compliant: "Compliant",
  expiring: "Expiring soon",
  expired: "Expired",
  missing: "Missing"
};

const STATUS_BAR_CLASS: Record<Status, string> = {
  compliant: "bg-emerald-500",
  expiring: "bg-amber-500",
  expired: "bg-rose-500",
  missing: "bg-slate-300"
};

const STATUS_DOT_CLASS: Record<Status, string> = {
  compliant: "bg-emerald-500",
  expiring: "bg-amber-500",
  expired: "bg-rose-500",
  missing: "bg-slate-300"
};

const STATUS_TEXT_CLASS: Record<Status, string> = {
  compliant: "text-emerald-700",
  expiring: "text-amber-700",
  expired: "text-rose-700",
  missing: "text-slate-500"
};

const VALID_STATUSES: Status[] = ["compliant", "expiring", "expired", "missing"];

// Mirrors ComplianceEndpoints.FilterMatrix on the backend exactly, so this page (fed by the same
// unfiltered /api/compliance-matrix the interactive page uses) always agrees with the on-screen
// Compliance page and the CSV export on what a given filter includes.
function filterMatrix(matrix: ComplianceMatrixDto, status: string | null, search: string | null, requirementId: string | null): ComplianceMatrixDto {
  const validStatus = (status && (VALID_STATUSES as string[]).includes(status) ? status : null) as Status | null;
  const term = search?.trim().toLowerCase() ?? "";

  if (!validStatus && !term && !requirementId) return matrix;

  let rows = matrix.rows.filter((row) => {
    if (requirementId) {
      const cell = row.cells.find((c) => c.requirementTypeId === requirementId);
      if (!cell) return false;
      if (validStatus && cell.status !== validStatus) return false;
    } else if (validStatus && !row.cells.some((c) => c.status === validStatus)) {
      return false;
    }
    if (term && !row.staffName.toLowerCase().includes(term) && !(row.jobTitle ?? "").toLowerCase().includes(term)) {
      return false;
    }
    return true;
  });

  if (requirementId) {
    rows = rows.map((row) => ({ ...row, cells: row.cells.filter((c) => c.requirementTypeId === requirementId) }));
    return { requirementTypes: matrix.requirementTypes.filter((r) => r.id === requirementId), rows };
  }

  return { ...matrix, rows };
}

function describeFilter(status: string | null, search: string | null, requirementName: string | null): string {
  const validStatus = status && (VALID_STATUSES as string[]).includes(status) ? (status as Status) : null;
  const parts: string[] = [];
  if (requirementName) parts.push(`Requirement = ${requirementName}`);
  if (validStatus) parts.push(`Status = ${STATUS_LABEL[validStatus]}`);
  if (search?.trim()) parts.push(`Search = "${search.trim()}"`);
  return parts.length === 0 ? "None (full snapshot)" : parts.join("; ");
}

type Segment = { status: Status; count: number; pct: number };

export default function ComplianceReportPage() {
  return (
    <Suspense fallback={<div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading report...</div>}>
      <ComplianceReportPageInner />
    </Suspense>
  );
}

function ComplianceReportPageInner() {
  const searchParams = useSearchParams();
  const status = searchParams?.get("status") ?? null;
  const search = searchParams?.get("search") ?? null;
  const requirementId = searchParams?.get("requirement") ?? null;

  const [fullMatrix, setFullMatrix] = useState<ComplianceMatrixDto | null>(null);
  const [tenantName, setTenantName] = useState<string>("CertiWatch");
  const [error, setError] = useState<string | null>(null);
  const [generatedAt] = useState(() => new Date());

  useEffect(() => {
    fetchJson<ComplianceMatrixDto>("/api/compliance-matrix")
      .then(setFullMatrix)
      .catch((err) => setError(err.message ?? "Failed to load compliance matrix"));
    fetchJson<{ tenantName: string }>("/api/tenant/me")
      .then((res) => setTenantName(res.tenantName))
      .catch(() => {});
  }, []);

  const requirementName = useMemo(
    () => fullMatrix?.requirementTypes.find((r) => r.id === requirementId)?.name ?? null,
    [fullMatrix, requirementId]
  );

  const matrix = useMemo(
    () => (fullMatrix ? filterMatrix(fullMatrix, status, search, requirementId) : null),
    [fullMatrix, status, search, requirementId]
  );

  const filterDescription = describeFilter(status, search, requirementName);

  if (error) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        Failed to load compliance report: {error}
      </div>
    );
  }

  if (!matrix) {
    return <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading report...</div>;
  }

  const totalStaff = matrix.rows.length;
  const compliantStaff = matrix.rows.filter((r) => r.cells.every((c) => c.status === "compliant")).length;
  const gapStaff = totalStaff - compliantStaff;
  const totalGaps = matrix.rows.reduce((acc, r) => acc + r.cells.filter((c) => c.status !== "compliant").length, 0);

  const allCells = matrix.rows.flatMap((r) => r.cells);
  const totalCells = allCells.length;
  const overallSegments: Segment[] = VALID_STATUSES.map((s) => {
    const count = allCells.filter((c) => c.status === s).length;
    return { status: s, count, pct: totalCells === 0 ? 0 : (count * 100) / totalCells };
  });

  // Worst-first (lowest compliance rate on top) - the biggest organisation-wide problem is the
  // first thing in the section, matching the old static report's ordering.
  const byRequirement = matrix.requirementTypes
    .map((req) => {
      const statuses = matrix.rows.map((row) => row.cells.find((c) => c.requirementTypeId === req.id)?.status ?? "missing");
      const total = statuses.length;
      const segments: Segment[] = VALID_STATUSES.map((s) => {
        const count = statuses.filter((st) => st === s).length;
        return { status: s, count, pct: total === 0 ? 0 : (count * 100) / total };
      });
      const compliantPct = total === 0 ? 0 : (segments[0].count * 100) / total;
      return { req, segments, total, compliantPct };
    })
    .sort((a, b) => a.compliantPct - b.compliantPct);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/compliance" className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to Compliance
        </Link>
        <button
          onClick={() => window.print()}
          className="rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Print / Save as PDF
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:border-none print:p-0 print:shadow-none">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white">CW</span>
          <span className="text-sm font-bold text-slate-900">CertiWatch</span>
        </div>
        <h1 className="mt-4 text-xl font-semibold text-slate-900">Compliance Summary - {tenantName}</h1>
        <p className="mt-1 text-sm text-slate-500">
          Generated {generatedAt.toLocaleDateString(undefined, { day: "2-digit", month: "long", year: "numeric" })},{" "}
          {generatedAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} &middot; Filter: {filterDescription}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Active staff" value={totalStaff} />
          <Stat label="Fully compliant" value={compliantStaff} />
          <Stat label="Staff with gaps" value={gapStaff} />
          <Stat label="Total gaps" value={totalGaps} />
        </div>

        <h2 className="mt-8 border-t border-slate-200 pt-4 text-base font-semibold text-slate-900">Overall status</h2>
        <p className="mt-0.5 text-xs text-slate-500">Every active staff member against every requirement, combined.</p>

        {totalCells === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Nothing tracked yet.</p>
        ) : (
          <>
            <div className="mt-4">
              <StatusBar segments={overallSegments} height="h-6" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {overallSegments.map((s) => (
                <div key={s.status} className="rounded-lg border border-slate-200 p-3">
                  <p className={`text-xl font-bold ${STATUS_TEXT_CLASS[s.status]}`}>{s.count}</p>
                  <p className="text-xs text-slate-500">
                    {STATUS_LABEL[s.status]} - {Math.round(s.pct)}%
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {totalCells} total checks across {totalStaff} staff and {matrix.requirementTypes.length} requirements. For which staff
              member has which gap, use the on-screen Compliance page (searchable and filterable) or the CSV export.
            </p>
          </>
        )}

        <h2 className="mt-8 border-t border-slate-200 pt-4 text-base font-semibold text-slate-900">Compliance by requirement</h2>
        <p className="mt-0.5 text-xs text-slate-500">Share of active staff compliant, expiring, or expired on each tracked requirement.</p>

        {totalStaff === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No active staff yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {byRequirement.map(({ req, segments, compliantPct }) => (
              <div key={req.id} className="flex items-center gap-3 py-0.5">
                <p className="w-40 flex-shrink-0 truncate text-xs text-slate-700 sm:w-52">{req.name}</p>
                <div className="min-w-0 flex-1">
                  <StatusBar segments={segments} height="h-3.5" />
                </div>
                <p className="w-24 flex-shrink-0 text-right text-xs text-slate-500">{Math.round(compliantPct)}% compliant</p>
              </div>
            ))}
          </div>
        )}

        <p className="mt-6 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-slate-200 pt-4 text-xs text-slate-500">
          {VALID_STATUSES.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${STATUS_DOT_CLASS[s]}`} />
              {STATUS_LABEL[s]}
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

// Every segment shows exact counts/percentage on hover (a real tooltip, not just a colored bar
// with nothing behind it) - and since hover obviously does nothing on a printed page, the numeric
// breakdown cards above the overall bar, and the "%compliant" label on every requirement row,
// carry the same information as plain text so nothing is hover-only in the one place (a printout)
// where hover can't exist at all.
function StatusBar({ segments, height }: { segments: Segment[]; height: string }) {
  const [hovered, setHovered] = useState<Status | null>(null);
  const visible = segments.filter((s) => s.count > 0);

  // The colored track needs overflow-hidden to clip square segments into a rounded bar - but a
  // tooltip floating above a segment is exactly the kind of content that same overflow-hidden
  // clips into invisibility. Keeping the track and the tooltip as siblings (tooltip positioned by
  // percentage against this outer, non-clipping wrapper) avoids that trap entirely.
  let cursor = 0;
  const hoveredSegment = visible.find((s) => s.status === hovered);
  let hoveredCenterPct = 0;
  for (const s of visible) {
    if (s.status === hovered) {
      hoveredCenterPct = cursor + s.pct / 2;
      break;
    }
    cursor += s.pct;
  }

  return (
    <div className="relative w-full">
      <div className={`flex w-full overflow-hidden rounded-md bg-slate-100 ${height}`}>
        {visible.map((s) => (
          <div
            key={s.status}
            onMouseEnter={() => setHovered(s.status)}
            onMouseLeave={() => setHovered(null)}
            className={`h-full cursor-default transition-opacity print:opacity-100 ${STATUS_BAR_CLASS[s.status]} ${
              hovered && hovered !== s.status ? "opacity-40" : ""
            }`}
            style={{ width: `${s.pct}%` }}
          />
        ))}
      </div>
      {hoveredSegment && (
        <div
          className="pointer-events-none absolute bottom-full z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg print:hidden"
          style={{ left: `${hoveredCenterPct}%` }}
        >
          <p className="font-semibold">
            {hoveredSegment.count} {STATUS_LABEL[hoveredSegment.status]}
          </p>
          <p className="text-slate-300">{Math.round(hoveredSegment.pct)}% of this row</p>
        </div>
      )}
    </div>
  );
}
