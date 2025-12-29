"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "../../../../../lib/api";

type AuditLog = {
  id: string;
  tenantId: string;
  tenantName: string;
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  meta?: string | null;
  createdAt: string;
};

export function TenantAuditClient({ tenantId }: { tenantId: string }) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [logins, setLogins] = useState<AuditLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = `?tenantId=${tenantId}&take=50`;
      const [audit, login] = await Promise.all([
        fetchJson<AuditLog[]>(`/api/platform/audit/logs${qs}`),
        fetchJson<AuditLog[]>(`/api/platform/audit/logins${qs}`)
      ]);
      setLogs(audit ?? []);
      setLogins(login ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load audit data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [tenantId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Audit & logins</h3>
        <button
          onClick={() => void load()}
          className="rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>
      {error && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title={`Audit log (${logs.length})`}>
          <Table
            headers={["Time", "Actor", "Action", "Meta"]}
            rows={logs.map((l) => [
              new Date(l.createdAt).toLocaleString(),
              l.actorEmail ?? "—",
              l.action,
              l.meta ?? "—"
            ])}
            emptyText="No audit events."
          />
        </Panel>
        <Panel title={`Recent logins (${logins.length})`}>
          <Table
            headers={["Time", "User", "Action"]}
            rows={logins.map((l) => [
              new Date(l.createdAt).toLocaleString(),
              l.actorEmail ?? "—",
              l.action
            ])}
            emptyText="No login events."
          />
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">{children}</div>
    </div>
  );
}

function Table({ headers, rows, emptyText }: { headers: string[]; rows: (string | number)[][]; emptyText: string }) {
  return (
    <div className="divide-y divide-slate-100">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {headers.map((h) => (
          <span key={h}>{h}</span>
        ))}
      </div>
      {rows.length === 0 && <div className="px-3 py-3 text-sm text-slate-600">{emptyText}</div>}
      {rows.map((r, idx) => (
        <div key={idx} className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3 px-3 py-3 text-sm text-slate-800">
          {r.map((c, i) => (
            <span key={i} className="truncate">
              {c}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
