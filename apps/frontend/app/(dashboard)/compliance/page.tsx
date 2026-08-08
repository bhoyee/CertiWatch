"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchJson } from "../../../lib/api";

type RequirementTypeDto = {
  id: string;
  tenantId: string | null;
  name: string;
  defaultValidityMonths: number | null;
  isRenewable: boolean;
  isGlobal: boolean;
};

type Status = "compliant" | "expiring" | "expired" | "missing";

type ComplianceCellDto = {
  requirementTypeId: string;
  status: Status;
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

const COLUMN_PREFS_KEY = "cw_compliance_columns_v1";

// Column order + hidden set are stored together so "manage" and "rearrange" are the same list -
// the order the admin leaves them in the popover is the order the table renders in.
type ColumnPrefs = { order: string[]; hidden: string[] };

function loadColumnPrefs(): ColumnPrefs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(COLUMN_PREFS_KEY);
    return raw ? (JSON.parse(raw) as ColumnPrefs) : null;
  } catch {
    return null;
  }
}

function saveColumnPrefs(prefs: ColumnPrefs) {
  try {
    window.localStorage.setItem(COLUMN_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Storage can be unavailable (private browsing, quota) - column order just won't persist.
  }
}

export default function CompliancePage() {
  const [matrix, setMatrix] = useState<ComplianceMatrixDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [onlyGaps, setOnlyGaps] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [columnsOpen, setColumnsOpen] = useState(false);

  useEffect(() => {
    fetchJson<ComplianceMatrixDto>("/api/compliance-matrix")
      .then((data) => {
        setMatrix(data);
        const stored = loadColumnPrefs();
        const allIds = data.requirementTypes.map((r) => r.id);
        if (stored) {
          // Keep the stored order for ids we still know about, then append anything new
          // (e.g. a requirement type added after prefs were last saved) at the end.
          const known = stored.order.filter((id) => allIds.includes(id));
          const missing = allIds.filter((id) => !known.includes(id));
          setColumnOrder([...known, ...missing]);
          setHiddenColumns(new Set(stored.hidden.filter((id) => allIds.includes(id))));
        } else {
          setColumnOrder(allIds);
        }
      })
      .catch((err) => setError(err.message ?? "Failed to load compliance matrix"));
  }, []);

  const persistColumns = (order: string[], hidden: Set<string>) => {
    setColumnOrder(order);
    setHiddenColumns(hidden);
    saveColumnPrefs({ order, hidden: Array.from(hidden) });
  };

  const requirementById = useMemo(() => {
    const map = new Map<string, RequirementTypeDto>();
    matrix?.requirementTypes.forEach((r) => map.set(r.id, r));
    return map;
  }, [matrix]);

  const visibleRequirements = useMemo(
    () => columnOrder.map((id) => requirementById.get(id)).filter((r): r is RequirementTypeDto => !!r && !hiddenColumns.has(r.id)),
    [columnOrder, hiddenColumns, requirementById]
  );

  // Row-level "has a gap" is derived once here rather than recomputed per render pass - both
  // the summary counts and the "only show gaps" filter read off the same flag. Gaps are judged
  // across ALL requirements, not just currently-visible columns, so hiding a column never makes
  // a staff member look more compliant than they actually are.
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  // Desktop table and mobile cards share one page of rows so switching layouts (or resizing)
  // never leaves the two views showing a different slice of staff.
  const paged = filtered.slice(pageStart, pageStart + pageSize);

  if (error) return <ErrorCard message={error} />;
  if (!matrix) return <LoadingCard />;

  const compliantStaffCount = rowsWithFlag.filter((r) => !r.hasGap).length;
  const gapStaffCount = rowsWithFlag.length - compliantStaffCount;
  const totalGaps = rowsWithFlag.reduce((acc, r) => acc + r.row.cells.filter((c) => c.status !== "compliant").length, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Compliance</h1>
        <p className="text-sm text-slate-600">Every active staff member against every requirement, at a glance.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard index={0} label="Fully compliant" value={compliantStaffCount} tone="emerald" icon="check-badge" />
        <StatCard index={1} label="Staff with gaps" value={gapStaffCount} tone="amber" icon="alert-triangle" />
        <StatCard index={2} label="Total gaps" value={totalGaps} tone="rose" icon="alert-octagon" />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search staff, role..."
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 sm:w-56"
              />
            </div>
            <label className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50">
              <input
                type="checkbox"
                checked={onlyGaps}
                onChange={(e) => {
                  setOnlyGaps(e.target.checked);
                  setPage(1);
                }}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Only show gaps
            </label>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm transition focus:border-blue-500 focus:outline-none"
            >
              {[10, 25, 50].map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
          </div>

          <ColumnManager
            requirementTypes={matrix.requirementTypes}
            order={columnOrder}
            hidden={hiddenColumns}
            open={columnsOpen}
            onOpenChange={setColumnsOpen}
            onChange={persistColumns}
          />
        </div>

        {matrix.rows.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">
            No active staff yet - add staff on the Staff page to see them here.
          </p>
        )}

        {matrix.rows.length > 0 && (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <Legend status="compliant" label="Compliant" />
              <Legend status="expiring" label="Expiring soon" />
              <Legend status="expired" label="Expired" />
              <Legend status="missing" label="Missing" />
            </div>

            <ComplianceTable rows={paged} requirements={visibleRequirements} />
            <div className="space-y-3 md:hidden">
              {paged.map(({ row, hasGap }, i) => (
                <ComplianceCard key={row.staffId} index={i} row={row} requirementTypes={matrix.requirementTypes} hasGap={hasGap} />
              ))}
              {paged.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No staff match your filters.</p>}
            </div>

            <div className="mt-3 flex flex-col gap-2 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
              <span>
                Showing {filtered.length === 0 ? 0 : pageStart + 1}-{Math.min(filtered.length, pageStart + pageSize)} of{" "}
                {filtered.length} staff
              </span>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-md border border-slate-200 px-3 py-1 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </button>
                <span className="text-slate-700">
                  Page {currentPage} / {totalPages}
                </span>
                <button
                  className="rounded-md border border-slate-200 px-3 py-1 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ComplianceTable({
  rows,
  requirements
}: {
  rows: Array<{ row: ComplianceRowDto; hasGap: boolean }>;
  requirements: RequirementTypeDto[];
}) {
  return (
    <div className="hidden md:block">
      {requirements.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">All columns are hidden - use "Columns" to bring some back.</p>
      ) : (
        <div className="max-h-[65vh] overflow-auto rounded-lg border border-slate-200">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-30 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Staff
                </th>
                {requirements.map((req) => (
                  <th
                    key={req.id}
                    title={`${req.name} - ${req.isRenewable ? `renews every ${req.defaultValidityMonths ?? "?"} months` : "one-time"}`}
                    className="sticky top-0 z-20 max-w-[120px] truncate border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
                  >
                    {req.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ row }, i) => (
                <tr key={row.staffId} className="group animate-fade-in" style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}>
                  <td className="sticky left-0 z-10 whitespace-nowrap border-b border-slate-100 bg-white px-4 py-2.5 text-slate-800 group-hover:bg-slate-50">
                    <p className="font-medium">{row.staffName}</p>
                    {row.jobTitle && <p className="text-xs text-slate-500">{row.jobTitle}</p>}
                  </td>
                  {row.cells
                    .filter((c) => requirements.some((r) => r.id === c.requirementTypeId))
                    .map((cell) => {
                      const req = requirements.find((r) => r.id === cell.requirementTypeId);
                      return (
                        <td
                          key={cell.requirementTypeId}
                          className="border-b border-slate-100 px-3 py-2.5 group-hover:bg-slate-50"
                        >
                          <StatusIcon status={cell.status} title={`${req?.name ?? ""}: ${statusLabel(cell.status)}`} />
                        </td>
                      );
                    })}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={requirements.length + 1} className="px-4 py-8 text-center text-sm text-slate-500">
                    No staff match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ColumnManager({
  requirementTypes,
  order,
  hidden,
  open,
  onOpenChange,
  onChange
}: {
  requirementTypes: RequirementTypeDto[];
  order: string[];
  hidden: Set<string>;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChange: (order: string[], hidden: Set<string>) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const byId = useMemo(() => new Map(requirementTypes.map((r) => [r.id, r])), [requirementTypes]);
  const ordered = order.map((id) => byId.get(id)).filter((r): r is RequirementTypeDto => !!r);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOpenChange(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open, onOpenChange]);

  const toggle = (id: string) => {
    const next = new Set(hidden);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(order, next);
  };

  const move = (id: string, dir: -1 | 1) => {
    const idx = order.indexOf(id);
    const target = idx + dir;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next, hidden);
  };

  const hiddenCount = hidden.size;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => onOpenChange(!open)}
        className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        <Icon name="sliders" className="h-4 w-4" />
        Columns
        {hiddenCount > 0 && (
          <span className="rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">{hiddenCount} hidden</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-72 origin-top-right animate-scale-in rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <p className="px-2 pb-2 pt-1 text-xs font-medium text-slate-500">
            Show, hide, or reorder the requirement columns shown in the table.
          </p>
          <div className="max-h-80 space-y-0.5 overflow-y-auto">
            {ordered.map((req, i) => (
              <div key={req.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={!hidden.has(req.id)}
                  onChange={() => toggle(req.id)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className={`flex-1 truncate text-sm ${hidden.has(req.id) ? "text-slate-400" : "text-slate-800"}`}>
                  {req.name}
                </span>
                <button
                  disabled={i === 0}
                  onClick={() => move(req.id, -1)}
                  className="rounded p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
                  title="Move up"
                >
                  <Icon name="chevron-up" className="h-3.5 w-3.5" />
                </button>
                <button
                  disabled={i === ordered.length - 1}
                  onClick={() => move(req.id, 1)}
                  className="rounded p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
                  title="Move down"
                >
                  <Icon name="chevron-down" className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ComplianceCard({
  row,
  requirementTypes,
  hasGap,
  index
}: {
  row: ComplianceRowDto;
  requirementTypes: RequirementTypeDto[];
  hasGap: boolean;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const gapCount = row.cells.filter((c) => c.status !== "compliant").length;

  return (
    <div
      className={`animate-fade-in-up overflow-hidden rounded-xl border bg-white shadow-sm transition ${
        hasGap ? "border-l-4 border-l-amber-400 border-slate-200" : "border-l-4 border-l-emerald-400 border-slate-200"
      }`}
      style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
    >
      <button onClick={() => setExpanded((v) => !v)} className="flex w-full items-center gap-3 p-3 text-left active:bg-slate-50">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${hasGap ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"}`}>
          <Icon name={hasGap ? "alert-triangle" : "check-badge"} className="h-[18px] w-[18px]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900">{row.staffName}</p>
          {row.jobTitle && <p className="truncate text-sm text-slate-600">{row.jobTitle}</p>}
        </div>
        <span className={`shrink-0 text-xs font-semibold ${hasGap ? "text-amber-700" : "text-emerald-700"}`}>
          {hasGap ? `${gapCount} issue${gapCount === 1 ? "" : "s"}` : "All good"}
        </span>
        <Icon name="chevron-down" className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      <div
        className={`grid transition-all duration-300 ease-out ${expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="overflow-hidden">
          <div className="space-y-1.5 border-t border-slate-100 px-3 py-3">
            {row.cells.map((cell) => {
              const req = requirementTypes.find((r) => r.id === cell.requirementTypeId);
              return (
                <div key={cell.requirementTypeId} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-slate-700">{req?.name ?? "Unknown"}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <StatusIcon status={cell.status} />
                    <span className={`text-xs font-medium ${statusTextClass(cell.status)}`}>{statusLabel(cell.status)}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone, icon, index }: { label: string; value: number; tone: "emerald" | "amber" | "rose"; icon: IconName; index: number }) {
  const tones: Record<string, string> = {
    emerald: "bg-emerald-100 text-emerald-600",
    amber: "bg-amber-100 text-amber-600",
    rose: "bg-rose-100 text-rose-600"
  };
  return (
    <div
      className="animate-fade-in-up rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-center gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon name={icon} className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-slate-600">{label}</p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function Legend({ status, label }: { status: Status; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <StatusIcon status={status} />
      {label}
    </span>
  );
}

function statusLabel(status: Status): string {
  return { compliant: "Compliant", expiring: "Expiring soon", expired: "Expired", missing: "Missing" }[status];
}

function statusTextClass(status: Status): string {
  return {
    compliant: "text-emerald-700",
    expiring: "text-amber-700",
    expired: "text-rose-700",
    missing: "text-slate-500"
  }[status];
}

function StatusIcon({ status, title }: { status: Status; title?: string }) {
  const styles: Record<Status, string> = {
    compliant: "bg-emerald-100 text-emerald-600",
    expiring: "bg-amber-100 text-amber-600",
    expired: "bg-rose-100 text-rose-600",
    missing: "border border-dashed border-slate-300 bg-slate-50 text-slate-400"
  };
  const iconFor: Record<Status, IconName> = {
    compliant: "check",
    expiring: "clock",
    expired: "alert-octagon",
    missing: "minus"
  };
  return (
    <span
      title={title}
      className={`inline-flex h-6 w-6 animate-scale-in items-center justify-center rounded-full transition-transform hover:scale-110 ${styles[status]}`}
    >
      <Icon name={iconFor[status]} className="h-3.5 w-3.5" />
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

type IconName =
  | "check"
  | "check-badge"
  | "clock"
  | "alert-octagon"
  | "alert-triangle"
  | "minus"
  | "search"
  | "sliders"
  | "chevron-up"
  | "chevron-down";

function Icon({ name, className }: { name: IconName; className?: string }) {
  const common = { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "check":
      return (
        <svg {...common}>
          <path d="M5 13l4 4L19 7" />
        </svg>
      );
    case "check-badge":
      return (
        <svg {...common}>
          <path d="M12 3l2.2 1.3 2.6-.2 1 2.4 2.2 1.3-.4 2.6 1.4 2.3-1.4 2.3.4 2.6-2.2 1.3-1 2.4-2.6-.2L12 21l-2.2-1.3-2.6.2-1-2.4-2.2-1.3.4-2.6L3 12l1.4-2.3-.4-2.6 2.2-1.3 1-2.4 2.6.2L12 3Z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3.5 2" />
        </svg>
      );
    case "alert-octagon":
      return (
        <svg {...common}>
          <path d="M8 3h8l5 5v8l-5 5H8l-5-5V8l5-5Z" />
          <path d="M12 8v5" />
          <path d="M12 16h.01" />
        </svg>
      );
    case "alert-triangle":
      return (
        <svg {...common}>
          <path d="M12 4 3 20h18L12 4Z" />
          <path d="M12 10v4" />
          <path d="M12 17h.01" />
        </svg>
      );
    case "minus":
      return (
        <svg {...common}>
          <path d="M5 12h14" />
        </svg>
      );
    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      );
    case "sliders":
      return (
        <svg {...common}>
          <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h10M18 18h2" />
          <circle cx="16" cy="6" r="2" fill="currentColor" stroke="none" />
          <circle cx="8" cy="12" r="2" fill="currentColor" stroke="none" />
          <circle cx="16" cy="18" r="2" fill="currentColor" stroke="none" />
        </svg>
      );
    case "chevron-up":
      return (
        <svg {...common}>
          <path d="m6 15 6-6 6 6" />
        </svg>
      );
    case "chevron-down":
      return (
        <svg {...common}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      );
  }
}
