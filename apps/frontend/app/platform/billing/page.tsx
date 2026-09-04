"use client";

import { useEffect, useState } from "react";
import { fetchJson, postVoid } from "@/lib/api";

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
  canceledLast30: number;
  churnRate: number;
  mrr: number;
  arr: number;
  upcomingRenewals: Renewal[];
};

type SubscriptionRow = {
  id: string;
  status: string;
  currentPeriodEnd?: string | null;
  trialEnd?: string | null;
  priceId?: string | null;
  monthlyAmount: number;
  currency: string;
  customerId?: string | null;
  tenantName: string;
  lastInvoiceId?: string | null;
  cancelAtPeriodEnd: boolean;
};

type InvoiceRow = {
  id: string;
  status: string;
  amountDue: number;
  amountPaid: number;
  currency: string;
  subscriptionId?: string | null;
  customerId?: string | null;
  tenantName: string;
  created: string;
  pdfUrl?: string | null;
  hostedInvoiceUrl?: string | null;
};

function formatCurrency(value?: number | null, currency?: string | null) {
  const amount = typeof value === "number" && Number.isFinite(value) ? value : 0;
  // Stripe currency codes are 3 letters; anything else (missing, empty, malformed) would make
  // Intl.NumberFormat throw a RangeError and take the whole page down with it - fall back to a
  // plain-number render instead of trusting the value is always well-formed.
  const code = (currency ?? "USD").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) {
    return `${amount.toFixed(2)} ${code || "?"}`.trim();
  }
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: code, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${code}`;
  }
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

export default function PlatformBillingPage() {
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const [ov, subs, inv] = await Promise.all([
        fetchJson<BillingOverview>("/api/platform/billing/overview"),
        fetchJson<{ total: number; items: SubscriptionRow[] }>("/api/platform/billing/subscriptions"),
        fetchJson<{ total: number; items: InvoiceRow[] }>("/api/platform/billing/invoices")
      ]);
      setOverview(ov);
      setSubscriptions(subs.items ?? []);
      setInvoices(inv.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load billing data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function withRefresh(action: () => Promise<void>) {
    try {
      setMessage(null);
      await action();
      await load();
      setMessage("Updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  }

  if (loading && !overview) {
    return <div className="p-6 text-sm text-slate-600">Loading billing data…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Platform billing</p>
          <h1 className="text-2xl font-semibold text-slate-900">Stripe overview</h1>
        </div>
        {overview && (
          <div className="rounded-full bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700">
            Total subscriptions: {overview.totalSubscriptions}
          </div>
        )}
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}

      {overview && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">MRR</p>
              <div className="text-2xl font-semibold text-slate-900">{formatCurrency(overview.mrr)}</div>
              <p className="text-xs text-slate-500">ARR {formatCurrency(overview.arr)}</p>
              <p className="text-xs text-slate-500">Churn (30d): {overview.churnRate}%</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Trials expiring (7d)</p>
              <div className="text-2xl font-semibold text-slate-900">{overview.trialsExpiring}</div>
              <p className="text-xs text-slate-500">Canceled last 30d: {overview.canceledLast30}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Past due</p>
              <div className="text-2xl font-semibold text-slate-900">{overview.pastDue}</div>
              <p className="text-xs text-slate-500">Trialing: {overview.trialing}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Active</p>
              <div className="text-2xl font-semibold text-slate-900">{overview.active}</div>
              <p className="text-xs text-slate-500">Canceled: {overview.canceled}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Upcoming renewals</h2>
              <p className="text-sm text-slate-500">Next 10</p>
            </div>
            {overview.upcomingRenewals.length === 0 ? (
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
                    {overview.upcomingRenewals.map((r) => (
                      <tr key={r.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-semibold text-slate-800">{r.tenantName}</td>
                        <td className="px-3 py-2 capitalize text-slate-700">{r.status ?? "—"}</td>
                        <td className="px-3 py-2 text-slate-700">{formatDate(r.renewOn)}</td>
                        <td className="px-3 py-2 text-slate-500">{r.id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Subscriptions</h2>
          <button
            className="rounded-lg border border-slate-200 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => void load()}
          >
            Refresh
          </button>
        </div>
        {subscriptions.length === 0 ? (
          <p className="py-6 text-sm text-slate-500">No subscriptions found.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-3 py-2">Tenant</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Renewal</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Plan</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((s) => (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-semibold text-slate-800">{s.tenantName}</td>
                    <td className="px-3 py-2 capitalize text-slate-700">
                      {s.status}
                      {s.cancelAtPeriodEnd && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">Canceling</span>}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{formatDate(s.currentPeriodEnd)}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {formatCurrency(s.monthlyAmount, s.currency)} / mo
                    </td>
                    <td className="px-3 py-2 text-slate-500">{s.priceId ?? "—"}</td>
                    <td className="px-3 py-2 space-x-2">
                      {s.lastInvoiceId && (
                        <button
                          className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                          onClick={() => withRefresh(() => postVoid(`/api/platform/billing/invoices/${s.lastInvoiceId}/resend`))}
                        >
                          Resend invoice
                        </button>
                      )}
                      <button
                        className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                        onClick={() => withRefresh(() => postVoid(`/api/platform/billing/subscriptions/${s.id}/cancel`))}
                      >
                        Cancel at period end
                      </button>
                      {s.status === "paused" ? (
                        <button
                          className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                          onClick={() => withRefresh(() => postVoid(`/api/platform/billing/subscriptions/${s.id}/resume`))}
                        >
                          Resume
                        </button>
                      ) : (
                        <button
                          className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                          onClick={() => withRefresh(() => postVoid(`/api/platform/billing/subscriptions/${s.id}/pause`))}
                        >
                          Pause
                        </button>
                      )}
                      <button
                        className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                        onClick={() => {
                          const priceId = prompt("Enter target price ID");
                          if (!priceId) return;
                          void withRefresh(() => postVoid(`/api/platform/billing/subscriptions/${s.id}/move-plan`, { priceId }));
                        }}
                      >
                        Move plan
                      </button>
                      {s.customerId && (
                        <button
                          className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                          onClick={() => {
                            const amountInput = prompt("Credit amount (USD dollars)");
                            if (!amountInput) return;
                            const dollars = parseFloat(amountInput);
                            if (Number.isNaN(dollars)) {
                              setError("Invalid amount");
                              return;
                            }
                            const cents = Math.round(dollars * 100);
                            void withRefresh(() =>
                              postVoid(`/api/platform/billing/customers/${s.customerId}/credit`, {
                                amount: cents,
                                currency: s.currency.toLowerCase(),
                                description: "Manual credit"
                              })
                            );
                          }}
                        >
                          Add credit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Recent invoices</h2>
          <p className="text-sm text-slate-500">Latest 100</p>
        </div>
        {invoices.length === 0 ? (
          <p className="py-6 text-sm text-slate-500">No invoices.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-3 py-2">Tenant</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2">Links</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-semibold text-slate-800">{i.tenantName}</td>
                    <td className="px-3 py-2 capitalize text-slate-700">{i.status}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {formatCurrency(i.amountDue, i.currency)} / paid {formatCurrency(i.amountPaid, i.currency)}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{formatDate(i.created)}</td>
                    <td className="px-3 py-2 space-x-2 text-xs">
                      {i.hostedInvoiceUrl && (
                        <a className="text-indigo-600 hover:underline" href={i.hostedInvoiceUrl} target="_blank" rel="noreferrer">
                          Hosted
                        </a>
                      )}
                      {i.pdfUrl && (
                        <a className="text-indigo-600 hover:underline" href={i.pdfUrl} target="_blank" rel="noreferrer">
                          PDF
                        </a>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                        onClick={() => withRefresh(() => postVoid(`/api/platform/billing/invoices/${i.id}/resend`))}
                      >
                        Resend
                      </button>
                    </td>
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
