import { fetchJson } from "../../../../lib/api";

type DayStat = { date: string; count: number };
type TenantStat = { tenantId: string; name: string; total: number; needsReview: number };
type Health = { postgres: string; worker: string; ocr: string; queueDepth: number };

type UsageOverview = {
  totalRecords: number;
  needsReview: number;
  okRecords: number;
  pendingRecords: number;
  last7Days: DayStat[];
  topTenants: TenantStat[];
  health: Health;
};

async function getUsage(): Promise<UsageOverview> {
  return await fetchJson<UsageOverview>("/api/platform/usage/overview");
}

function StatusBadge({ label, tone }: { label: string; tone?: "green" | "amber" | "red" | "slate" }) {
  const colors: Record<string, string> = {
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-rose-50 text-rose-700",
    slate: "bg-slate-100 text-slate-700"
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${colors[tone ?? "slate"]}`}>{label}</span>;
}

export default async function PlatformUsagePage() {
  const data = await getUsage();

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
                <div key={d.date} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="text-sm text-slate-600">{new Date(d.date).toLocaleDateString()}</span>
                  <span className="text-sm font-semibold text-slate-900">{d.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Health</h2>
            <StatusBadge
              label={data.health.postgres}
              tone={data.health.postgres.toLowerCase() === "ok" ? "green" : "red"}
            />
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span className="text-slate-600">Worker</span>
              <StatusBadge
                label={data.health.worker}
                tone={data.health.worker.toLowerCase() === "ok" ? "green" : "amber"}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span className="text-slate-600">OCR</span>
              <StatusBadge label={data.health.ocr} tone={data.health.ocr.toLowerCase() === "ok" ? "green" : "amber"} />
            </div>
          </div>
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
