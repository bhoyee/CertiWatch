"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/api";

type AuditEntry = {
  id: string;
  userEmail?: string | null;
  action: string;
  createdAt: string;
  meta?: Record<string, unknown>;
};

type LoginEntry = { email: string; createdAt: string };

export function TenantAuditClient({ tenantId }: { tenantId: string }) {
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [logins, setLogins] = useState<LoginEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      fetchJson<AuditEntry[]>(`/api/platform/tenants/${tenantId}/audit`),
      fetchJson<LoginEntry[]>(`/api/platform/tenants/${tenantId}/login-activity`),
    ])
      .then(([a, l]) => {
        if (!mounted) return;
        setAudit(a);
        setLogins(l);
        setLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err?.message ?? "Failed to load audit");
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [tenantId]);

  if (loading) return <div className="px-4 py-3 text-sm text-slate-600">Loading.</div>;
  if (error)
    return <div className="px-4 py-3 text-sm text-red-700">Failed to load audit log.</div>;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="divide-y divide-slate-100">
        <div className="bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Audit log</div>
        {audit.length === 0 && <div className="px-4 py-3 text-sm text-slate-600">No audit events.</div>}
        {audit.map((e) => (
          <div key={e.id} className="px-4 py-3 text-sm text-slate-800">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold">{e.action}</span>
              <span className="text-xs text-slate-500">{new Date(e.createdAt).toLocaleString()}</span>
            </div>
            <div className="text-xs text-slate-600">{e.userEmail ?? "system"}</div>
          </div>
        ))}
      </div>
      <div className="divide-y divide-slate-100">
        <div className="bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Recent logins
        </div>
        {logins.length === 0 && <div className="px-4 py-3 text-sm text-slate-600">No recent logins.</div>}
        {logins.map((l, idx) => (
          <div key={idx} className="px-4 py-3 text-sm text-slate-800">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold">{l.email}</span>
              <span className="text-xs text-slate-500">{new Date(l.createdAt).toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
