"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchJson } from "../../../lib/api";

type RequirementTypeDto = {
  id: string;
  tenantId: string | null;
  name: string;
  defaultValidityMonths: number | null;
  isRenewable: boolean;
  isGlobal: boolean;
};

type ComplianceCellDto = {
  requirementTypeId: string;
  status: "compliant" | "expiring" | "expired" | "missing";
};

type ComplianceRowDto = {
  staffId: string;
  staffName: string;
  jobTitle: string | null;
  cells: ComplianceCellDto[];
};

type ComplianceMatrixDto = {
  requirementTypes: RequirementTypeDto[];
  rows: ComplianceRowDto[];
};

export default function CompliancePage() {
  const [matrix, setMatrix] = useState<ComplianceMatrixDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [onlyGaps, setOnlyGaps] = useState(false);

  useEffect(() => {
    fetchJson<ComplianceMatrixDto>("/api/compliance-matrix")
      .then(setMatrix)
      .catch((err) => setError(err.message ?? "Failed to load compliance matrix"));
  }, []);

  // Row-level "has a gap" is derived once here rather than recomputed per render pass -
  // both the summary counts and the "only show gaps" filter read off the same flag.
  const rowsWithFlag = useMemo(() => {
    if (!matrix) return [];
    return matrix.rows.map((row) => ({
      row,
      hasGap: row.cells.some((c) => c.status !== "compliant")
    }));
  }, [matrix]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rowsWithFlag.filter(({ row, hasGap }) => {
      if (onlyGaps && !hasGap) return false;
      if (!term) return true;
      return row.staffName.toLowerCase().includes(term) || (row.jobTitle ?? "").toLowerCase().includes(term);
    });
  }, [rowsWithFlag, search, onlyGaps]);

  if (error) return <ErrorCard message={error} />;
  if (!matrix) return <LoadingCard />;

  const compliantStaffCount = rowsWithFlag.filter((r) => !r.hasGap).length;
  const gapStaffCount = rowsWithFlag.length - compliantStaffCount;
  const totalGaps = rowsWithFlag.reduce((acc, r) => acc + r.row.cells.filter((c) => c.status !== "compliant").length, 0);

  const cards = [
    { label: "Fully compliant", value: compliantStaffCount, accent: "from-emerald-500 to-green-500" },
    { label: "Staff with gaps", value: gapStaffCount, accent: "from-amber-500 to-orange-400" },
    { label: "Total gaps", value: totalGaps, accent: "from-rose-500 to-red-500" }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Compliance</h1>
        <p className="text-sm text-slate-600">Every active staff member against every requirement, at a glance.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">{card.label}</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{card.value}</p>
              </div>
              <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${card.accent} opacity-80`} />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search staff, role..."
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none md:w-64"
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={onlyGaps}
              onChange={(e) => setOnlyGaps(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Only show staff with gaps
          </label>
        </div>

        {matrix.rows.length === 0 && (
          <p className="py-4 text-center text-sm text-slate-500">
            No active staff yet - add staff on the Staff page to see them here.
          </p>
        )}

        {matrix.rows.length > 0 && (
          <>
            {/* Table: md and up */}
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Staff
                    </th>
                    {matrix.requirementTypes.map((req) => (
                      <th
                        key={req.id}
                        title={req.isRenewable ? `Renews every ${req.defaultValidityMonths ?? "?"} months` : "One-time"}
                        className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
                      >
                        {req.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filtered.map(({ row }) => (
                    <tr key={row.staffId} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-3 py-2 text-slate-800">
                        <p className="font-medium">{row.staffName}</p>
                        {row.jobTitle && <p className="text-xs text-slate-500">{row.jobTitle}</p>}
                      </td>
                      {row.cells.map((cell) => (
                        <td key={cell.requirementTypeId} className="px-3 py-2">
                          <StatusPill status={cell.status} />
                        </td>
                      ))}
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={matrix.requirementTypes.length + 1} className="px-3 py-4 text-center text-sm text-slate-500">
                        No staff match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Cards: below md */}
            <div className="space-y-3 md:hidden">
              {filtered.map(({ row, hasGap }) => (
                <ComplianceCard key={row.staffId} row={row} requirementTypes={matrix.requirementTypes} hasGap={hasGap} />
              ))}
              {filtered.length === 0 && <p className="py-4 text-center text-sm text-slate-500">No staff match your filters.</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ComplianceCard({
  row,
  requirementTypes,
  hasGap
}: {
  row: ComplianceRowDto;
  requirementTypes: RequirementTypeDto[];
  hasGap: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const gapCount = row.cells.filter((c) => c.status !== "compliant").length;

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start justify-between gap-2 text-left"
      >
        <div>
          <p className="font-semibold text-slate-900">{row.staffName}</p>
          {row.jobTitle && <p className="text-sm text-slate-600">{row.jobTitle}</p>}
        </div>
        {hasGap ? (
          <span className="inline-flex items-center rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
            {gapCount} issue{gapCount === 1 ? "" : "s"}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
            All compliant
          </span>
        )}
      </button>
      {expanded && (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          {row.cells.map((cell) => {
            const req = requirementTypes.find((r) => r.id === cell.requirementTypeId);
            return (
              <div key={cell.requirementTypeId} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">{req?.name ?? "Unknown"}</span>
                <StatusPill status={cell.status} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: ComplianceCellDto["status"] }) {
  const styles: Record<ComplianceCellDto["status"], string> = {
    compliant: "bg-emerald-100 text-emerald-800",
    expiring: "bg-amber-100 text-amber-800",
    expired: "bg-rose-100 text-rose-700",
    missing: "border border-dashed border-slate-300 bg-slate-50 text-slate-500"
  };
  const labels: Record<ComplianceCellDto["status"], string> = {
    compliant: "Compliant",
    expiring: "Expiring",
    expired: "Expired",
    missing: "Missing"
  };
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function LoadingCard() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
      Loading compliance matrix…
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
      Failed to load compliance matrix: {message}
    </div>
  );
}
