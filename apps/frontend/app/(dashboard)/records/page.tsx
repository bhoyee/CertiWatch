"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchJson } from "../../../lib/api";
import { useRole } from "../RoleContext";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5002";

type RecordDto = {
  id: string;
  documentId?: string;
  staffName: string;
  courseName: string;
  issuer: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  expiryDerived: boolean;
  confidence: number;
  confidenceBand?: string;
  documentType?: string | null;
  extractionConfidence?: number | null;
  processingStatus: string | number;
};

type PagedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export default function RecordsPage() {
  const { role } = useRole();
  const isViewer = role?.toLowerCase() === "viewer";
  const roleReady = role !== null;
  const canManage = roleReady && !isViewer;
  const [data, setData] = useState<PagedResult<RecordDto> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [sortField, setSortField] = useState<string>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteName, setConfirmDeleteName] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

  const toggleSort = (field: string) => {
    setPage(1);
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const load = useCallback(() => {
    setLoading(true);
    const params = buildParams();

    fetchJson<PagedResult<RecordDto>>(`/api/records?${params.toString()}`)
      .then((res) => {
        setData(res);
        setError(null);
        setLastUpdated(new Date());
      })
      .catch((err) => setError(err.message ?? "Failed to load records"))
      .finally(() => setLoading(false));
  }, [page, pageSize, search, status, sortField, sortDir]);

  const buildParams = () => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (search.trim()) params.set("filter", search.trim());
    if (status !== "all") params.set("status", status);
    if (sortField) params.set("sort", `${sortField}:${sortDir}`);
    return params;
  };

  const exportFile = async (kind: "csv" | "pdf") => {
    setExporting(kind);
    try {
      const params = buildParams();
      const res = await fetch(`${apiBase}/api/records/export.${kind}?${params.toString()}`, {
        credentials: "include"
      });
      if (!res.ok) {
        throw new Error(`Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = kind === "csv" ? "records-export.csv" : "records-export.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message ?? "Export failed");
    } finally {
      setExporting(null);
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  const requestDelete = (rec: RecordDto) => {
    setConfirmDeleteId(rec.id);
    setConfirmDeleteName(`${rec.staffName} - ${rec.courseName}`);
  };

  const performDelete = async () => {
    if (!confirmDeleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`${apiBase}/api/records/${confirmDeleteId}`, { method: "DELETE" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Delete failed (${res.status})`);
      }
      setConfirmDeleteId(null);
      setConfirmDeleteName(null);
      await load();
    } catch (err: any) {
      setError(err.message ?? "Failed to delete record");
    } finally {
      setDeleting(false);
    }
  };

  if (error) {
    return <ErrorCard message={error} />;
  }

  if (!data) {
    return <LoadingCard />;
  }

  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Records</h1>
          <p className="text-sm text-slate-600">Search, filter, and sort your records.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="Search staff, course, issuer"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            className="w-56 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="all">All statuses</option>
            <option value="ok">OK</option>
            <option value="needs_review">Needs review</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
          <button
            onClick={load}
            disabled={loading}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button
            onClick={() => exportFile("csv")}
            disabled={exporting !== null}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {exporting === "csv" ? "Exporting..." : "Export CSV"}
          </button>
          <button
            onClick={() => exportFile("pdf")}
            disabled={exporting !== null}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {exporting === "pdf" ? "Exporting..." : "Export PDF"}
          </button>
          <span className="text-xs text-slate-500">
            Total: {data.total}
            {lastUpdated && <> | Updated {lastUpdated.toLocaleTimeString()}</>}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <Header onClick={() => toggleSort("staffName")} sortField={sortField} sortDir={sortDir} field="staffName">
                Staff
              </Header>
              <Header onClick={() => toggleSort("courseName")} sortField={sortField} sortDir={sortDir} field="courseName">
                Course
              </Header>
              <Header onClick={() => toggleSort("issuer")} sortField={sortField} sortDir={sortDir} field="issuer">
                Issuer
              </Header>
              <Header onClick={() => toggleSort("issueDate")} sortField={sortField} sortDir={sortDir} field="issueDate">
                Issue
              </Header>
              <Header onClick={() => toggleSort("expiryDate")} sortField={sortField} sortDir={sortDir} field="expiryDate">
                Expiry
              </Header>
              <Header onClick={() => toggleSort("extractionConfidence")} sortField={sortField} sortDir={sortDir} field="extractionConfidence">
                Confidence
              </Header>
              <Header onClick={() => toggleSort("processingStatus")} sortField={sortField} sortDir={sortDir} field="processingStatus">
                Status
              </Header>
              {canManage && <Header>Actions</Header>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {data.items.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <Cell>{r.staffName}</Cell>
                <Cell>{r.courseName}</Cell>
                <Cell>{r.issuer ?? "--"}</Cell>
                <Cell>{r.issueDate ?? "--"}</Cell>
                <Cell>
                  {r.expiryDate ?? "--"}
                  {r.expiryDerived ? " (derived)" : ""}
                </Cell>
                <Cell>{formatConfidence(r.extractionConfidence)}</Cell>
                <Cell>{statusBadge(r.processingStatus, r.id, !canManage)}</Cell>
                {canManage && (
                  <Cell>
                    <div className="flex items-center gap-2">
                      <a
                        href={`/review?recordId=${r.id}`}
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        View
                      </a>
                      <button
                        onClick={() => requestDelete(r)}
                        className="rounded-md border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                      >
                        Delete
                      </button>
                    </div>
                  </Cell>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="text-xs text-slate-600">
          Page {page} of {totalPages}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Prev
          </button>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages}
            className="rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {confirmDeleteId && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Delete record?</h3>
            <p className="mt-2 text-sm text-slate-700">
              This will permanently delete the record{confirmDeleteName ? ` "${confirmDeleteName}"` : ""} and its file (if
              unused elsewhere). This cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  if (!deleting) {
                    setConfirmDeleteId(null);
                    setConfirmDeleteName(null);
                  }
                }}
                className="rounded-md border border-slate-200 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={performDelete}
                className="rounded-md bg-rose-600 px-3 py-1 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-60"
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Header({
  children,
  onClick,
  sortField,
  sortDir,
  field
}: {
  children: React.ReactNode;
  onClick?: () => void;
  sortField?: string;
  sortDir?: "asc" | "desc";
  field?: string;
}) {
  const isActive = field && sortField?.toLowerCase() === field.toLowerCase();
  return (
    <th
      onClick={onClick}
      className={`px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 ${
        onClick ? "cursor-pointer select-none hover:text-slate-900" : ""
      }`}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {isActive && <span className="text-[10px] text-slate-500">{sortDir === "asc" ? "^" : "v"}</span>}
      </span>
    </th>
  );
}

function Cell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 text-slate-800 ${className}`}>{children}</td>;
}

function LoadingCard() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">Loading records...</div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
      Failed to load records: {message}
    </div>
  );
}

function statusLabel(status: string | number): string {
  const map: Record<string, string> = {
    "0": "pending",
    "1": "ok",
    "2": "needs review",
    "3": "failed",
  };
  if (typeof status === "number") {
    return map[String(status)] ?? String(status);
  }
  const lower = status.toLowerCase();
  return map[lower] ?? lower;
}

function formatConfidence(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return `${Math.round(value * 100)}%`;
}

function statusBadge(status: string | number, id: string, isViewer: boolean) {
  const label = statusLabel(status);
  if (label === "needs review") {
    if (isViewer) {
      return (
        <span className="inline-flex items-center rounded-full bg-rose-600 px-2 py-1 text-xs font-semibold text-white">
          Needs review
        </span>
      );
    }
    return (
      <a
        href={`/review?recordId=${id}`}
        className="inline-flex items-center rounded-full bg-rose-600 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-500"
      >
        Review
      </a>
    );
  }
  if (label === "ok") {
    return <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">OK</span>;
  }
  return <span className="capitalize text-slate-700">{label}</span>;
}
