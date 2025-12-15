"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";

type Plan = {
  name: string;
  price: string;
  cycle: string;
  status: "active" | "trial" | "grace";
  renewsOn: string;
  seatsUsed: number;
  seatsLimit: number;
  recordsUsed: number;
  recordsLimit: number;
  storageUsedGb: number;
  storageLimitGb: number;
};

type Invoice = {
  id: string;
  date: string;
  amount: string;
  status: "paid" | "due" | "failed";
  downloadUrl?: string;
};

const currentPlan: Plan = {
  name: "Growth",
  price: "$249",
  cycle: "/month",
  status: "active",
  renewsOn: "2026-01-15",
  seatsUsed: 8,
  seatsLimit: 10,
  recordsUsed: 820,
  recordsLimit: 1200,
  storageUsedGb: 28,
  storageLimitGb: 50
};

const invoices: Invoice[] = [
  { id: "INV-2041", date: "2025-12-01", amount: "$249.00", status: "paid" },
  { id: "INV-2030", date: "2025-11-01", amount: "$249.00", status: "paid" },
  { id: "INV-2019", date: "2025-10-01", amount: "$249.00", status: "paid" }
];

const nextPlans = [
  { name: "Scale", price: "$499 / mo", features: ["Up to 3,000 records / mo", "Priority support", "SAML/SSO"] },
  { name: "Enterprise", price: "Contact us", features: ["Custom limits", "Dedicated CSM", "On-prem / VPC"] }
];

export default function PlanPage() {
  const usage = useMemo(() => {
    const seatPct = Math.min(100, Math.round((currentPlan.seatsUsed / currentPlan.seatsLimit) * 100));
    const recordPct = Math.min(100, Math.round((currentPlan.recordsUsed / currentPlan.recordsLimit) * 100));
    const storagePct = Math.min(100, Math.round((currentPlan.storageUsedGb / currentPlan.storageLimitGb) * 100));
    return { seatPct, recordPct, storagePct };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-slate-600">Billing & subscriptions</p>
          <h1 className="text-xl font-semibold text-slate-900">Manage plan</h1>
          <p className="text-sm text-slate-600">See usage, change plans, and download invoices.</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="#"
            className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:border-slate-300"
          >
            View invoices
          </Link>
          <Link
            href="#"
            className="rounded-md bg-gradient-to-r from-indigo-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95"
          >
            Manage plan
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Current plan</p>
              <h2 className="text-lg font-semibold text-slate-900">{currentPlan.name}</h2>
              <p className="text-sm text-slate-600">
                {currentPlan.price} {currentPlan.cycle} • Renews {formatDate(currentPlan.renewsOn)}
              </p>
            </div>
            <StatusPill status={currentPlan.status} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <UsageCard label="Records" used={currentPlan.recordsUsed} limit={currentPlan.recordsLimit} percent={usage.recordPct} />
            <UsageCard label="Seats" used={currentPlan.seatsUsed} limit={currentPlan.seatsLimit} percent={usage.seatPct} />
            <UsageCard label="Storage" used={`${currentPlan.storageUsedGb} GB`} limit={`${currentPlan.storageLimitGb} GB`} percent={usage.storagePct} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Need more?</p>
              <h2 className="text-lg font-semibold text-slate-900">Upgrade options</h2>
            </div>
            <span className="text-xs text-slate-500">No downgrade available from Growth</span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {nextPlans.map((plan) => (
              <div key={plan.name} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{plan.name}</p>
                    <p className="text-sm text-slate-600">{plan.price}</p>
                  </div>
                  <Link href="#" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
                    {plan.price === "Contact us" ? "Talk to sales" : "Upgrade"}
                  </Link>
                </div>
                <ul className="mt-2 space-y-1 text-sm text-slate-600">
                  {plan.features.map((f) => (
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
          <Link href="#" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
            Download CSV
          </Link>
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

function StatusPill({ status }: { status: Plan["status"] }) {
  const map = {
    active: "bg-emerald-100 text-emerald-700",
    trial: "bg-amber-100 text-amber-700",
    grace: "bg-rose-100 text-rose-700"
  };
  const label = status === "grace" ? "Grace period" : status === "trial" ? "Trial" : "Active";
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${map[status]}`}>{label}</span>;
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
