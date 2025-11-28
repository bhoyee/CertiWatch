"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "../../../lib/api";

type RecordDto = {
  id: string;
  staffName: string;
  courseName: string;
  issuer: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  expiryDerived: boolean;
  confidence: number;
  processingStatus: string | number;
};

type PagedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export default function RecordsPage() {
  const [data, setData] = useState<PagedResult<RecordDto> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<PagedResult<RecordDto>>("/api/records?take=10")
      .then(setData)
      .catch((err) => setError(err.message ?? "Failed to load records"));
  }, []);

  if (error) {
    return <ErrorCard message={error} />;
  }

  if (!data) {
    return <LoadingCard />;
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Records</h1>
          <p className="text-sm text-slate-600">Latest 10 records for your tenant.</p>
        </div>
        <span className="text-sm text-slate-600">Total: {data.total}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <Header>Staff</Header>
              <Header>Course</Header>
              <Header>Issuer</Header>
              <Header>Issue</Header>
              <Header>Expiry</Header>
              <Header>Status</Header>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {data.items.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <Cell>{r.staffName}</Cell>
                <Cell>{r.courseName}</Cell>
                <Cell>{r.issuer ?? "—"}</Cell>
                <Cell>{r.issueDate ?? "—"}</Cell>
                <Cell>
                  {r.expiryDate ?? "—"}
                  {r.expiryDerived ? " (derived)" : ""}
                </Cell>
                <Cell className="capitalize">{String(r.processingStatus).toLowerCase()}</Cell>
              </tr>
            ))}
          </tbody>
        </table>
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
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">Loading records…</div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
      Failed to load records: {message}
    </div>
  );
}
