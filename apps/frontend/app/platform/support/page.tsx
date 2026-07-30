"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { fetchJson, postVoid } from "@/lib/api";

type Ticket = {
  id: string;
  tenantId: string;
  tenantName: string;
  subject: string;
  status: string;
  assignedRole: string;
  assignedToUserId?: string | null;
  assignedToName?: string | null;
  createdByName?: string | null;
  createdAt: string;
  updatedAt: string;
};

type TicketResponse = { items: Ticket[]; total: number };
type Tenant = { id: string; name: string };

const statusOptions = [
  { value: "", label: "All statuses" },
  { value: "open", label: "Open" },
  { value: "pending", label: "Pending" },
  { value: "closed", label: "Closed" }
];

export default function PlatformSupportPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-600">Loading tickets.</div>}>
      <PlatformSupportPageContent />
    </Suspense>
  );
}

function PlatformSupportPageContent() {
  const router = useRouter();
  const search = useSearchParams();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const pageSize = 25;
  const tenantId = search.get("tenantId") ?? "";
  const status = search.get("status") ?? "";
  const page = Number(search.get("page") ?? "1");
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        if (tenantId) qs.set("tenantId", tenantId);
        if (status) qs.set("status", status);
        qs.set("page", safePage.toString());
        qs.set("pageSize", pageSize.toString());
        const [tixResp, tnts] = await Promise.all([
          fetchJson<TicketResponse>(`/api/platform/support/tickets${qs.toString() ? `?${qs}` : ""}`),
          fetchJson<Tenant[]>("/api/platform/tenants")
        ]);
        if (!active) return;
        setTickets(tixResp.items);
        setTotal(tixResp.total);
        setTenants(tnts.map((t) => ({ id: t.id, name: t.name })));
      } catch (e: any) {
        if (!active) return;
        setError(e?.message ?? "Failed to load tickets");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [tenantId, status, safePage]);

  const onFilterChange = (nextTenantId: string, nextStatus: string) => {
    const qs = new URLSearchParams();
    if (nextTenantId) qs.set("tenantId", nextTenantId);
    if (nextStatus) qs.set("status", nextStatus);
    router.push(`/platform/support${qs.toString() ? `?${qs}` : ""}`);
  };

  const goToPage = (nextPage: number) => {
    const qs = new URLSearchParams();
    if (tenantId) qs.set("tenantId", tenantId);
    if (status) qs.set("status", status);
    qs.set("page", nextPage.toString());
    router.push(`/platform/support?${qs.toString()}`);
  };

  const updateTicket = async (
    id: string,
    payload: Partial<Pick<Ticket, "status" | "assignedRole" | "assignedToUserId">> & { unassign?: boolean }
  ) => {
    setBusyId(id);
    setSavingStatus(payload.status ?? null);
    try {
      await postVoid(`/api/platform/support/tickets/${id}/status`, payload);
      setTickets((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                status: payload.status ?? t.status,
                assignedRole:
                  payload.unassign === true
                    ? "unassigned"
                    : payload.assignedRole ?? t.assignedRole ?? "unassigned",
                assignedToUserId: payload.unassign === true ? null : payload.assignedToUserId ?? t.assignedToUserId,
                assignedToName: payload.unassign === true ? null : t.assignedToName,
                updatedAt: new Date().toISOString()
              }
            : t
        )
      );
    } catch (e: any) {
      setError(e?.message ?? "Failed to update ticket");
    } finally {
      setBusyId(null);
      setSavingStatus(null);
    }
  };

  const tenantOptions = useMemo(() => [{ id: "", name: "All tenants" }, ...tenants], [tenants]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Platform - Support Tickets</h1>
          <p className="text-slate-600">Superadmin view of all tenant support tickets.</p>
        </div>
        <span className="text-sm font-medium text-slate-600">Total: {total}</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          label="Tenant"
          value={tenantId}
          options={tenantOptions.map((t) => ({ value: t.id, label: t.name }))}
          onChange={(v) => onFilterChange(v, status)}
        />
        <Select
          label="Status"
          value={status}
          options={statusOptions}
          onChange={(v) => onFilterChange(tenantId, v)}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-8 gap-3 border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>Tenant</span>
          <span>Subject</span>
          <span>Status</span>
          <span>Assigned</span>
          <span>Created by</span>
          <span>Created</span>
          <span>Updated</span>
          <span>Actions</span>
        </div>
        {loading && <div className="px-4 py-6 text-center text-sm text-slate-600">Loading tickets.</div>}
        {error && !loading && <div className="px-4 py-6 text-center text-sm text-rose-600">{error}</div>}
        {!loading && !error && tickets.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-slate-600">No tickets found.</div>
        )}
        {!loading &&
          !error &&
          tickets.map((t) => (
            <div
              key={t.id}
              className="grid grid-cols-8 gap-3 border-b border-slate-100 px-4 py-3 text-sm text-slate-800"
            >
              <span className="font-semibold text-slate-900">{t.tenantName}</span>
              <span className="truncate" title={t.subject}>
                {t.subject}
              </span>
              <StatusBadge value={t.status} />
              <span className="truncate">
                {t.assignedToName ?? "Unassigned"}
                {t.assignedRole ? ` · ${t.assignedRole}` : ""}
              </span>
              <span>{t.createdByName ?? "Unknown"}</span>
              <span>{new Date(t.createdAt).toLocaleString()}</span>
              <span>{new Date(t.updatedAt).toLocaleString()}</span>
              <div className="flex flex-wrap items-center gap-2">
                <ActionButton
                  label="Open"
                  onClick={() => updateTicket(t.id, { status: "open" })}
                  disabled={busyId === t.id}
                />
                <ActionButton
                  label="Pending"
                  onClick={() => updateTicket(t.id, { status: "pending" })}
                  disabled={busyId === t.id}
                />
                <ActionButton
                  label="Close"
                  onClick={() => updateTicket(t.id, { status: "closed" })}
                  disabled={busyId === t.id}
                />
                <ActionButton
                  label="Escalate"
                  onClick={() =>
                    updateTicket(t.id, { assignedRole: "superadmin", assignedToUserId: null, unassign: true })
                  }
                  disabled={busyId === t.id}
                />
                <ActionButton
                  label="Unassign"
                  onClick={() => updateTicket(t.id, { unassign: true })}
                  disabled={busyId === t.id}
                />
                {savingStatus && busyId === t.id && <span className="text-xs text-slate-500">Saving.</span>}
              </div>
            </div>
          ))}
      </div>

      <Pagination
        total={total}
        page={safePage}
        pageSize={pageSize}
        loading={loading}
        onPageChange={goToPage}
      />
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  const v = value?.toLowerCase();
  const cls =
    v === "open"
      ? "bg-amber-100 text-amber-800"
      : v === "pending"
      ? "bg-blue-100 text-blue-800"
      : v === "closed"
      ? "bg-emerald-100 text-emerald-800"
      : "bg-slate-100 text-slate-700";
  return (
    <span className={`w-fit rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{value ?? "unknown"}</span>
  );
}

function ActionButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {label}
    </button>
  );
}

type SelectOption = { value: string; label: string };
function Select({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (next: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-slate-400 focus:outline-none"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Pagination({
  total,
  page,
  pageSize,
  loading,
  onPageChange
}: {
  total: number;
  page: number;
  pageSize: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
}) {
  const hasPrev = page > 1;
  const hasNext = page * pageSize < total;
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
      <span>
        Showing {start}-{end} of {total}
      </span>
      <div className="flex items-center gap-2">
        <button
          className="rounded-md border border-slate-200 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrev || loading}
        >
          Prev
        </button>
        <button
          className="rounded-md border border-slate-200 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext || loading}
        >
          Next
        </button>
      </div>
    </div>
  );
}
