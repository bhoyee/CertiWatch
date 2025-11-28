"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchJson } from "../../lib/api";

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

export default function DashboardHome() {
  const [data, setData] = useState<AnalyticsOverviewDto | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-600">Expiring soon (next 30 days)</p>
            <p className="text-lg font-semibold text-slate-900">{data.expiringSoon} records</p>
          </div>
        </div>
        <div className="-mx-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <Header>Staff</Header>
                <Header>Course</Header>
                <Header>Expiry</Header>
                <Header>Status</Header>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.expiringSoonList.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <Cell>{r.staffName}</Cell>
                  <Cell>{r.courseName}</Cell>
                  <Cell>{r.expiryDate ?? "—"}</Cell>
                  <Cell className="capitalize">{String(r.processingStatus).toLowerCase()}</Cell>
                </tr>
              ))}
            </tbody>
          </table>
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
                  {count} · {pct}%
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

function Header({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">{children}</th>;
}

function Cell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 text-slate-800 ${className}`}>{children}</td>;
}

function LoadingCard() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">Loading analytics…</div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
      Failed to load analytics: {message}
    </div>
  );
}
