"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "../../../lib/api";
import { useRole } from "../RoleContext";

type AnalyticsOverviewDto = {
  totalRecords: number;
  expiringSoon: number;
  expired: number;
  lowConfidence: number;
  devices: number;
  sources: number;
  statusCounts: Record<string, number>;
  expiringSoonList: ExpiringRow[];
};

type ReminderPreviewDto = {
  expiringIn7: number;
  expiringIn30: number;
  needsReview: number;
  upcoming: Array<{ id: string; staffName: string; courseName: string; expiryDate: string; issuer?: string | null }>;
};

type ExpiringRow = {
  id: string;
  staffName: string | null;
  courseName: string | null;
  issuer?: string | null;
  issueDate?: string | null;
  expiryDate: string | null;
  expiryDerived?: boolean;
  confidence?: number;
  processingStatus?: string | number;
};

export default function AnalyticsPage() {
  const { role } = useRole();
  const isViewer = role?.toLowerCase() === "viewer";
  const isManager = role?.toLowerCase() === "manager";
  const [data, setData] = useState<AnalyticsOverviewDto | null>(null);
  const [reminders, setReminders] = useState<ReminderPreviewDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<"staff" | "course" | "expiry" | "status">("expiry");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    fetchJson<AnalyticsOverviewDto>("/api/reports/analytics")
      .then(setData)
      .catch((err) => setError(err.message ?? "Failed to load analytics"));

    fetchJson<ReminderPreviewDto>("/api/notifications/reminders/preview")
      .then(setReminders)
      .catch((err) => setReminderError(err.message ?? "Failed to load reminders"));
  }, []);

  if (error) return <ErrorCard message={error} />;
  if (!data) return <LoadingCard />;

  const baseCards = [
    { label: "Total records", value: data.totalRecords, accent: "from-indigo-500 to-blue-500" },
    { label: "Expiring soon", value: data.expiringSoon, accent: "from-amber-500 to-orange-400" },
    { label: "Expired", value: data.expired, accent: "from-rose-500 to-red-500" },
    { label: "Low confidence", value: data.lowConfidence, accent: "from-slate-500 to-slate-600" },
    { label: "Devices", value: data.devices, accent: "from-emerald-500 to-green-500" },
    { label: "Sources", value: data.sources, accent: "from-cyan-500 to-sky-500" }
  ];
  const cards =
    isViewer || isManager
      ? baseCards.filter((card) => card.label !== "Devices" && card.label !== "Sources")
      : baseCards;

  const statusEntries = Object.entries(data.statusCounts ?? {});
  const expiringList: ExpiringRow[] =
    reminders?.upcoming?.map((row) => ({
      id: row.id,
      staffName: row.staffName ?? null,
      courseName: row.courseName ?? null,
      issuer: row.issuer ?? null,
      expiryDate: row.expiryDate ?? null
    })) ??
    data.expiringSoonList ??
    [];

  const filteredSoon = expiringList.filter((r) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    const staff = (r.staffName ?? "").toLowerCase();
    const course = (r.courseName ?? "").toLowerCase();
    const issuer = (r.issuer ?? "").toLowerCase();
    return staff.includes(term) || course.includes(term) || issuer.includes(term);
  });

  const sortedSoon = [...filteredSoon].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortKey) {
      case "staff":
        return (a.staffName ?? "").localeCompare(b.staffName ?? "") * dir;
      case "course":
        return (a.courseName ?? "").localeCompare(b.courseName ?? "") * dir;
      case "expiry":
      default: {
        const aDate = a.expiryDate ?? "";
        const bDate = b.expiryDate ?? "";
        return aDate.localeCompare(bDate) * dir;
      }
    }
  });

  const totalPages = Math.max(1, Math.ceil(sortedSoon.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const visibleSoon = sortedSoon.slice(start, start + pageSize);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Analytics</h1>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
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

      {statusEntries.length > 0 && <StatusBars entries={statusEntries} />}

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-slate-600">Expiring soon (next 30 days)</p>
            <p className="text-lg font-semibold text-slate-900">{data.expiringSoon} records</p>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:justify-end">
            {reminderError && <p className="text-xs text-rose-600">Reminder preview unavailable</p>}
            {reminders && (
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge color="bg-amber-100 text-amber-800">30 days: {reminders.expiringIn30}</Badge>
                <Badge color="bg-rose-100 text-rose-700">7 days: {reminders.expiringIn7}</Badge>
                <Badge color="bg-indigo-100 text-indigo-700">Needs review: {reminders.needsReview}</Badge>
              </div>
            )}
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search staff, course, issuer..."
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none md:w-64"
            />
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              {[10, 25, 50].map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="-mx-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <Header onClick={() => toggleSort("staff")} sorted={sortKey === "staff"} dir={sortDir}>
                    Staff
                  </Header>
                  <Header onClick={() => toggleSort("course")} sorted={sortKey === "course"} dir={sortDir}>
                    Course
                  </Header>
                  <Header onClick={() => toggleSort("expiry")} sorted={sortKey === "expiry"} dir={sortDir}>
                    Expiry
                  </Header>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {visibleSoon.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <Cell>{r.staffName ?? "--"}</Cell>
                    <Cell>{r.courseName ?? "--"}</Cell>
                    <Cell>{r.expiryDate ?? "--"}</Cell>
                  </tr>
                ))}
                {visibleSoon.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-center text-sm text-slate-500">
                      No records match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
        </div>
        <div className="mt-3 flex flex-col gap-2 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
          <span>
            Showing {sortedSoon.length === 0 ? 0 : start + 1}-{Math.min(sortedSoon.length, start + pageSize)} of {sortedSoon.length} records
          </span>
          <div className="flex items-center gap-2">
            <button
              className="rounded-md border border-slate-200 px-3 py-1 text-sm font-medium text-slate-700 disabled:opacity-50"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            <span className="text-slate-700">
              Page {currentPage} / {totalPages}
            </span>
            <button
              className="rounded-md border border-slate-200 px-3 py-1 text-sm font-medium text-slate-700 disabled:opacity-50"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBars({ entries }: { entries: Array<[string, number]> }) {
  const total = entries.reduce((acc, [, v]) => acc + v, 0);
  if (total === 0) return null;
  const colorFor = (status: string) => {
    const key = status.toLowerCase();
    if (key.includes("review")) return "bg-rose-500";
    if (key.includes("ok")) return "bg-emerald-500";
    if (key.includes("pending")) return "bg-amber-500";
    if (key.includes("fail")) return "bg-slate-500";
    return "bg-blue-500";
  };
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="mb-3 text-sm font-medium text-slate-900">Processing status</p>
      <div className="space-y-2">
        {entries.map(([status, count]) => {
          const pct = Math.round((count / total) * 100);
          const bar = colorFor(status);
          return (
            <div key={status}>
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span className="capitalize">{status.toLowerCase()}</span>
                <span>
                  {count} | {pct}%
                </span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-slate-100">
                <div className={`h-2 rounded-full ${bar}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Header({
  children,
  onClick,
  sorted,
  dir
}: {
  children: React.ReactNode;
  onClick?: () => void;
  sorted?: boolean;
  dir?: "asc" | "desc";
}) {
  return (
    <th
      className={`px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 ${
        onClick ? "cursor-pointer select-none" : ""
      }`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      <div className="flex items-center gap-1">
        <span>{children}</span>
        {sorted && <span className="text-slate-400">{dir === "asc" ? "^" : "v"}</span>}
      </div>
    </th>
  );
}

function Cell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 text-slate-800 ${className}`}>{children}</td>;
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-1 font-semibold ${color}`}>{children}</span>;
}

function LoadingCard() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">Loading analytics...</div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
      Failed to load analytics: {message}
    </div>
  );
}
