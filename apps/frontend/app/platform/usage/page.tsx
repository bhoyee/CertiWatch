"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/api";

type DayStat = { date: string; count: number };
type TenantStat = { tenantId: string; name: string; total: number; needsReview: number };
type Health = { postgres: string; redis: string; worker: string; ocr: string; queueDepth: number; queueDepthTrend: number[] };

type UsageOverview = {
  totalRecords: number;
  needsReview: number;
  okRecords: number;
  pendingRecords: number;
  last7Days: DayStat[];
  topTenants: TenantStat[];
  health: Health;
};

function StatusBadge({ label, tone }: { label: string; tone?: "green" | "amber" | "red" | "slate" }) {
  const colors: Record<string, string> = {
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-rose-50 text-rose-700",
    slate: "bg-slate-100 text-slate-700"
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${colors[tone ?? "slate"]}`}>{label}</span>;
}

export default function PlatformUsagePage() {
  const [data, setData] = useState<UsageOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchJson<UsageOverview>("/api/platform/usage/overview")
      .then((res) => {
        if (active) setData(res);
      })
      .catch((err: any) => {
        if (active) setError(err?.message ?? "Failed to load usage data");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <div className="p-6 text-sm text-slate-600">Loading usage data…</div>;
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {error ?? "Failed to load usage data"}
      </div>
    );
  }

  const maxCount = data.last7Days.length ? Math.max(...data.last7Days.map((d) => d.count)) : 1;

  const cards = [
    { label: "Total records", value: data.totalRecords },
    { label: "Needs review", value: data.needsReview },
    { label: "OK", value: data.okRecords },
    { label: "Pending", value: data.pendingRecords }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Platform usage</p>
          <h1 className="text-2xl font-semibold text-slate-900">Records & health</h1>
        </div>
        <StatusBadge
          label={`Queue depth: ${data.health.queueDepth}`}
          tone={data.health.queueDepth > 50 ? "amber" : "green"}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">{c.label}</p>
            <div className="text-2xl font-semibold text-slate-900">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Last 7 days</h2>
            <p className="text-sm text-slate-500">Uploads/reviewed</p>
          </div>
          {data.last7Days.length === 0 ? (
            <p className="py-6 text-sm text-slate-500">No recent activity.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {data.last7Days.map((d) => (
                <div key={d.date} className="space-y-1 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span>{new Date(d.date).toLocaleDateString()}</span>
                    <span className="font-semibold text-slate-900">{d.count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${Math.max(8, Math.round((d.count / maxCount) * 100))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Health</h2>
              <p className="text-sm text-slate-500">Workers, OCR, Redis, queue depth</p>
            </div>
            <StatusBadge
              label={data.health.postgres}
              tone={data.health.postgres.toLowerCase() === "ok" ? "green" : "red"}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <HealthCard
              label="Redis"
              status={data.health.redis}
              tone={data.health.redis.toLowerCase() === "ok" ? "green" : "amber"}
              hint="Cache & queues"
            />
            <HealthCard
              label="Worker"
              status={data.health.worker}
              tone={data.health.worker.toLowerCase() === "ok" ? "green" : "amber"}
              hint="Ingestion + notifications"
            />
            <HealthCard
              label="OCR"
              status={data.health.ocr}
              tone={data.health.ocr.toLowerCase() === "ok" ? "green" : "amber"}
              hint="PaddleOCR extraction"
            />
            <HealthCard
              label="Queue depth"
              status={`${data.health.queueDepth}`}
              tone={data.health.queueDepth > 50 ? "amber" : "green"}
              hint="Pending jobs"
            />
          </div>
          {data.health.queueDepthTrend?.length ? (
            <div className="mt-2 space-y-1">
              <p className="text-xs text-slate-500">Queue depth trend (last 7 days)</p>
              <div className="flex items-end gap-1">
                {data.health.queueDepthTrend.map((v, idx) => {
                  const max = Math.max(...data.health.queueDepthTrend, 1);
                  const h = Math.max(6, Math.round((v / max) * 50));
                  return (
                    <div key={idx} className="w-8 rounded-t bg-emerald-500" style={{ height: `${h}px` }}>
                      <span className="sr-only">{v}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Top tenants (needs review)</h2>
          <p className="text-sm text-slate-500">Top 10 by queue</p>
        </div>
        {data.topTenants.length === 0 ? (
          <p className="py-6 text-sm text-slate-500">No tenants in queue.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-3 py-2">Tenant</th>
                  <th className="px-3 py-2">Needs review</th>
                  <th className="px-3 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.topTenants.map((t) => (
                  <tr key={t.tenantId} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-semibold text-slate-800">{t.name}</td>
                    <td className="px-3 py-2 text-rose-700">{t.needsReview}</td>
                    <td className="px-3 py-2 text-slate-700">{t.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function HealthCard({
  label,
  status,
  tone,
  hint
}: {
  label: string;
  status: string;
  tone: "green" | "amber" | "red" | "slate";
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
      <div>
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
      <StatusBadge label={status} tone={tone} />
    </div>
  );
}
