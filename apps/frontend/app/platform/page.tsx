"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/api";

type TenantDto = {
  id: string;
  name: string;
  plan?: string | null;
  subscriptionStatus?: string | null;
  createdAtUtc?: string;
  recordCount?: number;
  userCount?: number;
};

type UsageOverview = {
  totalRecords: number;
  needsReview: number;
  okRecords: number;
  pendingRecords: number;
  health: {
    postgres: string;
    redis: string;
    worker: string;
    ocr: string;
    queueDepth: number;
  };
};

export default function PlatformDashboardPage() {
  const [tenants, setTenants] = useState<TenantDto[]>([]);
  const [usage, setUsage] = useState<UsageOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      fetchJson<TenantDto[]>("/api/platform/tenants"),
      fetchJson<UsageOverview>("/api/platform/usage/overview"),
    ])
      .then(([tenantData, usageData]) => {
        if (mounted) {
          setTenants(tenantData);
          setUsage(usageData);
          setLoading(false);
        }
      })
      .catch((err: any) => {
        if (mounted) {
          setError(err?.message ?? "Failed to load dashboard");
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return <div className="p-6 text-sm text-slate-600">Loading dashboard.</div>;
  }

  if (error) {
    return (
      <div className="p-6 text-sm text-rose-600">
        Failed to load dashboard: {error}
      </div>
    );
  }

  const totalTenants = tenants.length;
  const active = tenants.filter(
    (t) => (t.subscriptionStatus ?? "").toLowerCase() === "active",
  ).length;
  const trialing = tenants.filter(
    (t) => (t.subscriptionStatus ?? "").toLowerCase() === "trialing",
  ).length;
  const pastDue = tenants.filter((t) =>
    (t.subscriptionStatus ?? "").includes("past"),
  ).length;

  const recentTenants = [...tenants]
    .sort(
      (a, b) =>
        new Date(b.createdAtUtc ?? "").getTime() -
        new Date(a.createdAtUtc ?? "").getTime(),
    )
    .slice(0, 5);

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-slate-500">Platform overview</p>
            <h1 className="text-2xl font-semibold text-slate-900">
              Superadmin dashboard
            </h1>
            <p className="text-sm text-slate-500">
              Monitor tenants, billing state, usage, and support signals at a
              glance.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/platform/tenants"
              className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow hover:bg-slate-800"
            >
              View tenants
            </Link>
            <Link
              href="/platform/support"
              className="inline-flex items-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
            >
              Support desk
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Tenants" value={totalTenants} accent="bg-slate-900" />
        <SummaryCard label="Active" value={active} accent="bg-emerald-500" />
        <SummaryCard label="Trialing" value={trialing} accent="bg-amber-400" />
        <SummaryCard label="Past due" value={pastDue} accent="bg-rose-500" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Tenants
              </p>
              <h2 className="text-lg font-semibold text-slate-900">
                Recently onboarded
              </h2>
            </div>
            <Link
              href="/platform/tenants"
              className="text-sm font-medium text-slate-700 hover:text-slate-900"
            >
              See all
            </Link>
          </div>
          {recentTenants.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
              No tenants yet. Once tenants are created, they will show here.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-right">Records</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {recentTenants.map((tenant) => (
                    <tr key={tenant.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {tenant.name}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {tenant.plan ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={tenant.subscriptionStatus} />
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {tenant.createdAtUtc
                          ? new Date(tenant.createdAtUtc).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-900">
                        {tenant.recordCount ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Health
              </p>
              <h3 className="text-lg font-semibold text-slate-900">
                System signals
              </h3>
            </div>
            <Link
              href="/platform/usage"
              className="text-sm font-medium text-slate-700 hover:text-slate-900"
            >
              View
            </Link>
          </div>
          <ul className="space-y-2 text-sm">
            {[
              { label: "Postgres", status: usage?.health.postgres ?? "unknown" },
              { label: "Redis", status: usage?.health.redis ?? "unknown" },
              { label: "Worker", status: usage?.health.worker ?? "unknown" },
              { label: "OCR", status: usage?.health.ocr ?? "unknown" },
            ].map((item) => (
              <li
                key={item.label}
                className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
              >
                <span className="text-slate-700">{item.label}</span>
                <HealthPill status={item.status} />
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            {usage
              ? `Queue depth: ${usage.health.queueDepth} pending. ${usage.needsReview} record(s) need review.`
              : "Tip: drill into Usage & Health for live pings and queue depth trends."}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
        </div>
        <span className={`h-10 w-10 rounded-full ${accent} opacity-90`} />
      </div>
    </div>
  );
}

function StatusPill({ status }: { status?: string | null }) {
  const normalized = (status ?? "").toLowerCase();
  let color = "bg-slate-100 text-slate-700";
  if (normalized.includes("active")) color = "bg-emerald-50 text-emerald-700";
  else if (normalized.includes("trial")) color = "bg-amber-50 text-amber-700";
  else if (normalized.includes("past") || normalized.includes("due"))
    color = "bg-rose-50 text-rose-700";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${color}`}
    >
      {status ?? "—"}
    </span>
  );
}

function HealthPill({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const color =
    normalized === "ok"
      ? "bg-emerald-50 text-emerald-700"
      : normalized === "unknown"
        ? "bg-slate-100 text-slate-600"
        : "bg-rose-50 text-rose-700";
  const label = normalized === "ok" ? "Healthy" : normalized === "unknown" ? "Unknown" : "Down";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}
