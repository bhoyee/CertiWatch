"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/api";

type Tenant = {
  id: string;
  name: string;
  plan?: string | null;
  subscriptionStatus?: string | null;
  currentPeriodEndUtc?: string | null;
  pilotAccessUntilUtc?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  recordCount?: number;
  userCount?: number;
  createdAtUtc?: string | null;
};

// Every status rendered the same neutral gray badge, which made the column useless at a glance -
// an admin scanning for trouble (past_due, suspended) had to read every row's text instead of
// spotting color. Reuses the semantic palette already established elsewhere in the app (emerald
// for healthy, amber for needs-attention-but-not-cut-off, rose for cut-off).
function subscriptionBadgeClasses(status?: string | null): string {
  switch ((status ?? "").trim().toLowerCase()) {
    case "active":
      return "bg-emerald-100 text-emerald-700";
    case "trialing":
      return "bg-blue-100 text-blue-700";
    case "past_due":
      return "bg-amber-100 text-amber-700";
    case "canceled":
      return "bg-orange-100 text-orange-700";
    case "suspended":
      return "bg-rose-100 text-rose-700";
    default:
      // No Stripe subscription yet (freshly provisioned tenant) - genuinely neutral, not a
      // problem state, so it keeps the original gray rather than borrowing a semantic color.
      return "bg-slate-100 text-slate-600";
  }
}

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
          <thead className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th className="border-b-2 border-slate-300 px-4 py-3">Name</th>
              <th className="border-b-2 border-slate-300 px-4 py-3">Plan</th>
              <th className="border-b-2 border-slate-300 px-4 py-3">Subscription</th>
              <th className="border-b-2 border-slate-300 px-4 py-3">Users</th>
              <th className="border-b-2 border-slate-300 px-4 py-3">Records</th>
              <th className="border-b-2 border-slate-300 px-4 py-3">Created</th>
              <th className="border-b-2 border-slate-300 px-4 py-3">Details</th>
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
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${subscriptionBadgeClasses(t.subscriptionStatus)}`}>
                    {t.subscriptionStatus || "unknown"}
                  </span>
                  {t.pilotAccessUntilUtc && new Date(t.pilotAccessUntilUtc).getTime() > Date.now() && (
                    <span
                      className="ml-1.5 rounded-full bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-700"
                      title={`Pilot access until ${new Date(t.pilotAccessUntilUtc).toLocaleString()}`}
                    >
                      Pilot
                    </span>
                  )}
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
