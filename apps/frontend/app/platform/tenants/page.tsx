"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchJson } from "../../../lib/api";

type Tenant = {
  id: string;
  name: string;
  plan?: string | null;
  subscriptionStatus?: string | null;
  currentPeriodEndUtc?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  recordCount?: number;
  userCount?: number;
  createdAtUtc?: string | null;
};

export default function PlatformTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchJson<Tenant[]>("/api/platform/tenants")
      .then((data) => {
        if (mounted) {
          setTenants(data);
          setLoading(false);
        }
      })
      .catch((err: any) => {
        if (mounted) {
          setError(err?.message ?? "Failed to load tenants");
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return <div className="p-6 text-sm text-slate-600">Loading tenants.</div>;
  }

  if (error) {
    return (
      <div className="p-6 text-sm text-rose-600">
        Failed to load tenants: {error}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Tenants</h1>
        <p className="text-sm text-slate-600">
          Platform view of all tenants, plans, and subscription state.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Subscription</th>
              <th className="px-4 py-3">Users</th>
              <th className="px-4 py-3">Records</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {tenants.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">
                  {t.name || "-"}
                </td>
                <td className="px-4 py-3 text-slate-700">{t.plan || "-"}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                    {t.subscriptionStatus || "unknown"}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {t.userCount ?? 0}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {t.recordCount ?? 0}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {t.createdAtUtc
                    ? new Date(t.createdAtUtc).toLocaleDateString()
                    : "-"}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/platform/tenants/${t.id}`}
                    className="text-indigo-600 hover:text-indigo-800"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {tenants.length === 0 && (
          <div className="p-4 text-sm text-slate-600">No tenants found.</div>
        )}
      </div>
    </div>
  );
}
