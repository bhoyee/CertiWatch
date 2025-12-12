"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchJson } from "../../../lib/api";

type AnalyticsOverviewDto = {
  totalRecords: number;
  expiringSoon: number;
  expired: number;
  lowConfidence: number;
  devices: number;
  sources: number;
  statusCounts: Record<string, number>;
  expiringSoonList: Array<{
    id: string;
    staffName: string;
    courseName: string;
    issuer: string | null;
    issueDate: string | null;
    expiryDate: string | null;
    expiryDerived: boolean;
    confidence: number;
    processingStatus: string | number;
  }>;
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsOverviewDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: "staff" | "course" | "expiry" | "status"; dir: "asc" | "desc" }>({
    key: "expiry",
    dir: "asc"
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    fetchJson<AnalyticsOverviewDto>("/api/reports/analytics")
      .then(setData)
      .catch((err) => setError(err.message ?? "Failed to load analytics"));
  }, []);

  if (error) return <ErrorCard message={error} />;
  if (!data) return <LoadingCard />;

  const cards = [
    { label: "Total records", value: data.totalRecords },
    { label: "Expiring soon", value: data.expiringSoon },
    { label: "Expired", value: data.expired },
    { label: "Low confidence", value: data.lowConfidence },
    { label: "Devices", value: data.devices },
    { label: "Sources", value: data.sources }
  ];

  const statusEntries = Object.entries(data.statusCounts);

  const filteredSoon = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.expiringSoonList.filter((r) => {
      if (!term) return true;
      return (
        r.staffName.toLowerCase().includes(term) ||
        r.courseName.toLowerCase().includes(term) ||
        (r.issuer ?? "").toLowerCase().includes(term)
      );
    });
  }, [data, search]);

  const sortedSoon = useMemo(() => {
    const list = [...filteredSoon];
    const dir = sort.dir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      switch (sort.key) {
        case "staff":
          return a.staffName.localeCompare(b.staffName) * dir;
        case "course":
          return a.courseName.localeCompare(b.courseName) * dir;
        case "status":
          return String(a.processingStatus).localeCompare(String(b.processingStatus)) * dir;
        case "expiry":
        default: {
          const aDate = a.expiryDate ?? "";
          const bDate = b.expiryDate ?? "";
          return aDate.localeCompare(bDate) * dir;
        }
      }
    });
    return list;
  }, [filteredSoon, sort]);

  const totalPages = Math.max(1, Math.ceil(sortedSoon.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const visibleSoon = sortedSoon.slice(start, start + pageSize);

  const setSortKey = (key: typeof sort.key) => {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Analytics</h1>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-600">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{card.value}</p>
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
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
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
                <Header onClick={() => setSortKey("staff")} sorted={sort.key === "staff"} dir={sort.dir}>
                  Staff
                </Header>
                <Header onClick={() => setSortKey("course")} sorted={sort.key === "course"} dir={sort.dir}>
                  Course
                </Header>
                <Header onClick={() => setSortKey("expiry")} sorted={sort.key === "expiry"} dir={sort.dir}>
                  Expiry
                </Header>
                <Header onClick={() => setSortKey("status")} sorted={sort.key === "status"} dir={sort.dir}>
                  Status
                </Header>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {visibleSoon.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <Cell>{r.staffName}</Cell>
                  <Cell>{r.courseName}</Cell>
                  <Cell>{r.expiryDate ?? "--"}</Cell>
                  <Cell className="capitalize">{String(r.processingStatus).toLowerCase()}</Cell>
                </tr>
              ))}
              {visibleSoon.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-sm text-slate-500">
                    No records match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-col gap-2 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
          <span>
            Showing {sortedSoon.length === 0 ? 0 : start + 1}–{Math.min(sortedSoon.length, start + pageSize)} of{" "}
            {sortedSoon.length} records
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
  const total = useMemo(() => entries.reduce((acc, [, v]) => acc + v, 0), [entries]);
  if (total === 0) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="mb-3 text-sm font-medium text-slate-900">Processing status</p>
      <div className="space-y-2">
        {entries.map(([status, count]) => {
          const pct = Math.round((count / total) * 100);
          return (
            <div key={status}>
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span className="capitalize">{status.toLowerCase()}</span>
                <span>
                  {count} • {pct}%
                </span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
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
        {sorted && <span className="text-slate-400">{dir === "asc" ? "▲" : "▼"}</span>}
      </div>
    </th>
  );
}

function Cell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 text-slate-800 ${className}`}>{children}</td>;
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
