"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/api";

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

export default function PlatformSecurityPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [logins, setLogins] = useState<AuditLog[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [audit, login] = await Promise.all([
          fetchJson<AuditLog[]>("/api/platform/audit/logs"),
          fetchJson<AuditLog[]>("/api/platform/audit/logins")
        ]);
        if (!active) return;
        setLogs(audit ?? []);
        setLogins(login ?? []);
      } catch (err) {
        if (active) setError((err as any).message ?? "Failed to load security data");
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Platform security</h1>
        <p className="text-sm text-slate-600">Audit logs and recent login activity across all tenants.</p>
        {error && <p className="mt-2 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Audit log</h2>
          <span className="text-xs text-slate-500">{logs.length} events</span>
        </div>
        <div className="max-h-[420px] overflow-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
              <tr>
                <th className="border-b-2 border-slate-300 px-4 py-2">Time</th>
                <th className="border-b-2 border-slate-300 px-4 py-2">Tenant</th>
                <th className="border-b-2 border-slate-300 px-4 py-2">Actor</th>
                <th className="border-b-2 border-slate-300 px-4 py-2">Action</th>
                <th className="border-b-2 border-slate-300 px-4 py-2">Meta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-700">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2 text-slate-700">{log.tenantName}</td>
                  <td className="px-4 py-2 text-slate-700">{log.actorEmail ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-700">{log.action}</td>
                  <td className="px-4 py-2 text-slate-700 truncate max-w-xs">{log.meta ?? "—"}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-center text-slate-500">
                    No audit events yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Recent logins</h2>
          <span className="text-xs text-slate-500">{logins.length} events</span>
        </div>
        <div className="max-h-[320px] overflow-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
              <tr>
                <th className="border-b-2 border-slate-300 px-4 py-2">Time</th>
                <th className="border-b-2 border-slate-300 px-4 py-2">Tenant</th>
                <th className="border-b-2 border-slate-300 px-4 py-2">User</th>
                <th className="border-b-2 border-slate-300 px-4 py-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logins.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-700">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2 text-slate-700">{log.tenantName}</td>
                  <td className="px-4 py-2 text-slate-700">{log.actorEmail ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-700">{log.action}</td>
                </tr>
              ))}
              {logins.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-center text-slate-500">
                    No login events yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
