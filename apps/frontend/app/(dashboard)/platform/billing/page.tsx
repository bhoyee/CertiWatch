import { fetchJson } from "../../../../lib/api";

type Renewal = {
  id: string;
  status: string;
  renewOn?: string | null;
  tenantName: string;
};

type BillingOverview = {
  totalSubscriptions: number;
  active: number;
  pastDue: number;
  trialing: number;
  canceled: number;
  trialsExpiring: number;
  mrr: number;
  arr: number;
  upcomingRenewals: Renewal[];
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

async function getOverview(): Promise<BillingOverview> {
  return await fetchJson<BillingOverview>("/api/platform/billing/overview");
}

export default async function PlatformBillingPage() {
  const data = await getOverview();

  const stats = [
    { label: "Active", value: data.active },
    { label: "Past due", value: data.pastDue },
    { label: "Trialing", value: data.trialing },
    { label: "Trials expiring (7d)", value: data.trialsExpiring },
    { label: "Canceled", value: data.canceled }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Platform billing</p>
          <h1 className="text-2xl font-semibold text-slate-900">Stripe overview</h1>
        </div>
        <div className="rounded-full bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700">
          Total subscriptions: {data.totalSubscriptions}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">MRR</p>
          <div className="text-2xl font-semibold text-slate-900">{formatCurrency(data.mrr)}</div>
          <p className="text-xs text-slate-500">ARR {formatCurrency(data.arr)}</p>
        </div>
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">{s.label}</p>
            <div className="text-2xl font-semibold text-slate-900">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Upcoming renewals</h2>
          <p className="text-sm text-slate-500">Next 10</p>
        </div>
        {data.upcomingRenewals.length === 0 ? (
          <p className="py-6 text-sm text-slate-500">No renewals scheduled.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-3 py-2">Tenant</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Renewal</th>
                  <th className="px-3 py-2">Subscription</th>
                </tr>
              </thead>
              <tbody>
                {data.upcomingRenewals.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-semibold text-slate-800">{r.tenantName}</td>
                    <td className="px-3 py-2 capitalize text-slate-700">{r.status ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {r.renewOn ? new Date(r.renewOn).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-500">{r.id}</td>
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
