"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { fetchJson } from "../../../../lib/api";

type Ticket = {
  id: string;
  tenantId: string;
  tenantName: string;
  subject: string;
  status: string;
  assignedToName?: string | null;
  createdByName?: string | null;
  createdAt: string;
  updatedAt: string;
};

type Tenant = { id: string; name: string };

const statusOptions = [
  { value: "", label: "All statuses" },
  { value: "open", label: "Open" },
  { value: "pending", label: "Pending" },
  { value: "closed", label: "Closed" }
];

export default function PlatformSupportPage() {
  const router = useRouter();
  const search = useSearchParams();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tenantId = search.get("tenantId") ?? "";
  const status = search.get("status") ?? "";

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        if (tenantId) qs.set("tenantId", tenantId);
        if (status) qs.set("status", status);
        const [tix, tnts] = await Promise.all([
          fetchJson<Ticket[]>(`/api/platform/support/tickets${qs.toString() ? `?${qs}` : ""}`),
          fetchJson<Tenant[]>("/api/platform/tenants")
        ]);
        if (!active) return;
        setTickets(tix);
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
  }, [tenantId, status]);

  const onFilterChange = (nextTenantId: string, nextStatus: string) => {
    const qs = new URLSearchParams();
    if (nextTenantId) qs.set("tenantId", nextTenantId);
    if (nextStatus) qs.set("status", nextStatus);
    router.push(`/platform/support${qs.toString() ? `?${qs}` : ""}`);
  };

  const tenantOptions = useMemo(() => [{ id: "", name: "All tenants" }, ...tenants], [tenants]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Platform - Support Tickets</h1>
          <p className="text-slate-600">Superadmin view of all tenant support tickets.</p>
        </div>
        <span className="text-sm font-medium text-slate-600">Total: {tickets.length}</span>
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
        <div className="grid grid-cols-7 gap-3 border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>Tenant</span>
          <span>Subject</span>
          <span>Status</span>
          <span>Assigned</span>
          <span>Created by</span>
          <span>Created</span>
          <span>Updated</span>
        </div>
        {loading && <div className="px-4 py-6 text-center text-sm text-slate-600">Loading tickets…</div>}
        {error && !loading && <div className="px-4 py-6 text-center text-sm text-rose-600">{error}</div>}
        {!loading && !error && tickets.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-slate-600">No tickets found.</div>
        )}
        {!loading &&
          !error &&
          tickets.map((t) => (
            <div
              key={t.id}
              className="grid grid-cols-7 gap-3 border-b border-slate-100 px-4 py-3 text-sm text-slate-800"
            >
              <span className="font-semibold text-slate-900">{t.tenantName}</span>
              <span className="truncate" title={t.subject}>
                {t.subject}
              </span>
              <StatusBadge value={t.status} />
              <span>{t.assignedToName ?? "Unassigned"}</span>
              <span>{t.createdByName ?? "Unknown"}</span>
              <span>{new Date(t.createdAt).toLocaleString()}</span>
              <span>{new Date(t.updatedAt).toLocaleString()}</span>
            </div>
          ))}
      </div>
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
