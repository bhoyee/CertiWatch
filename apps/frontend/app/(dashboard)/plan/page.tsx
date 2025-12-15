"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchJson } from "../../../lib/api";

type TenantPlanDto = {
  tenantName: string;
  planId: string;
  planName: string;
  recordLimit: number;
  recordCount: number;
  deviceCount: number;
  sourceCount: number;
  subscriptionStatus?: string | null;
  currentPeriodEndUtc?: string | null;
};

type Invoice = {
  id: string;
  date: string;
  amount: string;
  status: "paid" | "due" | "failed";
  downloadUrl?: string;
};

const catalog = [
  {
    id: "starter",
    name: "Starter",
    price: "$99/mo",
    summary: "For small teams getting off spreadsheets.",
    limits: "50 records/month",
    extras: ["Local folders", "30-day retention"]
  },
  {
    id: "growth",
    name: "Growth",
    price: "$249/mo",
    summary: "For growing orgs with cloud connectors.",
    limits: "500 records/month",
    extras: ["Google/OneDrive/Dropbox", "1-year retention"]
  },
  {
    id: "pro",
    name: "Pro",
    price: "$499/mo",
    summary: "For ops teams that need everything.",
    limits: "Unlimited records",
    extras: ["Webhooks/API", "Priority support"]
  }
];

export default function PlanPage() {
  const [plan, setPlan] = useState<TenantPlanDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    fetchJson<TenantPlanDto>("/api/tenant/me")
      .then(setPlan)
      .catch((err) => setError(err.message ?? "Failed to load plan"));

    fetchJson<Invoice[]>("/api/billing/invoices")
      .then(setInvoices)
      .catch(() => setInvoices([]));
  }, []);

  const usage = useMemo(() => {
    if (!plan) return { recordPct: 0 };
    if (!plan.recordLimit || plan.recordLimit <= 0) return { recordPct: 0 };
    return { recordPct: Math.min(100, Math.round((plan.recordCount / plan.recordLimit) * 100)) };
  }, [plan]);

  const tier = useMemo(() => {
    const name = plan?.planName.toLowerCase() ?? "";
    if (name.includes("starter")) return "starter";
    if (name.includes("growth")) return "growth";
    if (name.includes("pro")) return "pro";
    return "custom";
  }, [plan]);

  const currentCatalogPlan = useMemo(() => catalog.find((c) => c.id === tier), [tier]);

  const nextOptions = useMemo(() => {
    if (tier === "starter") return catalog.filter((c) => c.id !== "starter");
    if (tier === "growth") return catalog.filter((c) => c.id === "pro");
    return [];
  }, [tier]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-slate-600">Billing & subscriptions</p>
          <h1 className="text-xl font-semibold text-slate-900">Manage plan</h1>
          <p className="text-sm text-slate-600">See usage, change plans, and download invoices.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={openPortal}
            disabled={portalLoading}
            className="rounded-md bg-gradient-to-r from-indigo-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-60"
          >
            {portalLoading ? "Opening portal..." : "Open billing portal"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {!plan && !error && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">Loading plan...</div>
      )}

      {plan && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Current plan</p>
                  <h2 className="text-lg font-semibold text-slate-900">{plan.planName}</h2>
              <p className="text-sm text-slate-600">Tenant: {plan.tenantName}</p>
              <p className="text-sm text-slate-600">
                {currentCatalogPlan ? `${currentCatalogPlan.price} • ${currentCatalogPlan.summary}` : "Custom pricing"}
              </p>
            </div>
            <StatusPill status={(plan.subscriptionStatus as any) ?? "active"} />
          </div>
          <p className="text-xs text-slate-500">
            {renewDate ? `Renews on ${renewDate}` : "Renewal date not available"} • Status: {subscriptionLabel}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <UsageCard
              label="Records"
              used={plan.recordCount}
              limit={plan.recordLimit > 0 ? plan.recordLimit : "No cap"}
                  percent={usage.recordPct}
                />
                <UsageCard label="Devices" used={plan.deviceCount} limit={"Included"} percent={0} />
                <UsageCard label="Sources" used={plan.sourceCount} limit={"Included"} percent={0} />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Need more?</p>
                  <h2 className="text-lg font-semibold text-slate-900">Upgrade options</h2>
                </div>
                <span className="text-xs text-slate-500">
                  {nextOptions.length === 0 ? "You’re on the top tier" : "Choose a higher plan"}
                </span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {nextOptions.map((p) => (
                  <div key={p.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{p.name}</p>
                        <p className="text-sm text-slate-600">{p.price}</p>
                      </div>
                      <Link href="#" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
                        {p.price.toLowerCase().includes("contact") ? "Talk to sales" : "Upgrade"}
                      </Link>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{p.summary}</p>
                    <ul className="mt-2 space-y-1 text-sm text-slate-600">
                      <li className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {p.limits}
                      </li>
                      {p.extras.map((f) => (
                        <li key={f} className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm text-slate-600">Billing history</p>
                <h2 className="text-lg font-semibold text-slate-900">Invoices</h2>
              </div>
              <button className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">Download CSV</button>
            </div>
            <div className="-mx-3 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <Th>ID</Th>
                    <Th>Date</Th>
                    <Th>Amount</Th>
                    <Th>Status</Th>
                    <Th>Action</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <Td>{inv.id}</Td>
                      <Td>{formatDate(inv.date)}</Td>
                      <Td>{inv.amount}</Td>
                      <Td>
                        <StatusBadge status={inv.status} />
                      </Td>
                      <Td>
                        <Link href={inv.downloadUrl ?? "#"} className="text-indigo-600 hover:text-indigo-700">
                          Download
                        </Link>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {invoices.length === 0 && (
                <div className="px-3 py-4 text-sm text-slate-500">No invoices yet.</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function UsageCard({ label, used, limit, percent }: { label: string; used: number | string; limit: number | string; percent: number }) {
  const pct = Math.min(100, Math.max(0, percent));
  const barColor = pct > 90 ? "bg-rose-500" : pct > 75 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-center justify-between text-sm font-semibold text-slate-900">
        <span>{label}</span>
        <span className="text-slate-700">
          {used} / {limit}
        </span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-100">
        <div className={`h-2 rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-slate-500">{pct}% of limit</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map = {
    active: "bg-emerald-100 text-emerald-700",
    trial: "bg-amber-100 text-amber-700",
    grace: "bg-rose-100 text-rose-700"
  };
  const lowered = (status ?? "active").toLowerCase();
  const label = lowered == "grace" ? "Grace period" : lowered == "trial" ? "Trial" : lowered == "past_due" ? "Past due" : "Active";
  const color = map[(lowered as keyof typeof map)] ?? map.active;
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${color}`}>{label}</span>;
}

function StatusBadge({ status }: { status: Invoice["status"] }) {
  const styles = {
    paid: "bg-emerald-100 text-emerald-700",
    due: "bg-amber-100 text-amber-700",
    failed: "bg-rose-100 text-rose-700"
  };
  const label = status === "paid" ? "Paid" : status === "due" ? "Due" : "Failed";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}>{label}</span>;
}

function Th({ children }: { children: ReactNode }) {
  return <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return <td className="px-3 py-2 text-sm text-slate-700">{children}</td>;
}

function formatDate(value: string) {
  const dt = new Date(value);
  if (isNaN(dt.getTime())) return value;
  return dt.toLocaleDateString();
}
  const subscriptionLabel = useMemo(() => {
    if (!plan?.subscriptionStatus) return "Unknown";
    return plan.subscriptionStatus.replace("_", " ");
  }, [plan]);

  const renewDate = plan?.currentPeriodEndUtc ? new Date(plan.currentPeriodEndUtc).toLocaleDateString() : null;

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      if (!res.ok) throw new Error("Unable to create billing portal session");
      const data = (await res.json()) as { url?: string };
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError((err as any).message ?? "Unable to open billing portal");
    } finally {
      setPortalLoading(false);
    }
  };
