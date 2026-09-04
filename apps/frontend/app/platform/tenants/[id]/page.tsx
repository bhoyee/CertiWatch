"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchJson } from "@/lib/api";

type TenantUser = {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  isDisabled: boolean;
  createdAt: string;
};

type TenantDetail = {
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
  billingEmail?: string | null;
  cancelAtUtc?: string | null;
  users?: TenantUser[];
};

export default function TenantDetailPage() {
  const params = useParams();
  const tenantId = params?.id as string | undefined;

  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userPage, setUserPage] = useState(1);
  const userPageSize = 10;

  useEffect(() => {
    if (!tenantId) return;
    let mounted = true;
    fetchJson<TenantDetail>(`/api/platform/tenants/${tenantId}`)
      .then((data) => {
        if (mounted) {
          setTenant(data);
          setLoading(false);
        }
      })
      .catch((err: any) => {
        if (mounted) {
          setError(err?.message ?? "Failed to load tenant");
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [tenantId]);

  if (!tenantId) {
    return (
      <div className="p-6 text-sm text-rose-600">
        Missing tenant id in the URL.
      </div>
    );
  }

  if (loading) {
    return <div className="p-6 text-sm text-slate-600">Loading tenant.</div>;
  }

  if (error) {
    return (
      <div className="p-6 text-sm text-rose-600">
        Failed to load tenant: {error}
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="p-6 text-sm text-rose-600">
        Tenant not found or an error occurred.
      </div>
    );
  }

  const users = tenant.users ?? [];
  const totalUserPages = Math.max(1, Math.ceil(users.length / userPageSize));
  const currentUserPage = Math.min(userPage, totalUserPages);
  const userStart = (currentUserPage - 1) * userPageSize;
  const pagedUsers = users.slice(userStart, userStart + userPageSize);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Tenant
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            {tenant.name || "Unnamed tenant"}
          </h1>
          <p className="text-sm text-slate-600">
            Plan: {tenant.plan || "—"} • Subscription:{" "}
            {tenant.subscriptionStatus || "unknown"}
          </p>
        </div>
        <Link
          href="/platform/tenants"
          className="text-sm text-indigo-600 hover:text-indigo-800"
        >
          ← Back to tenants
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <DetailCard title="Subscription">
          <DetailRow label="Plan" value={tenant.plan || "—"} />
          <DetailRow
            label="Status"
            value={tenant.subscriptionStatus || "unknown"}
          />
          <DetailRow
            label="Period ends"
            value={
              tenant.currentPeriodEndUtc
                ? new Date(tenant.currentPeriodEndUtc).toLocaleString()
                : "—"
            }
          />
          <DetailRow
            label="Cancel at"
            value={
              tenant.cancelAtUtc
                ? new Date(tenant.cancelAtUtc).toLocaleString()
                : "—"
            }
          />
          <DetailRow
            label="Stripe customer"
            value={tenant.stripeCustomerId || "—"}
          />
          <DetailRow
            label="Stripe subscription"
            value={tenant.stripeSubscriptionId || "—"}
          />
        </DetailCard>

        <DetailCard title="Stats">
          <DetailRow label="Users" value={(tenant.userCount ?? 0).toString()} />
          <DetailRow
            label="Records"
            value={(tenant.recordCount ?? 0).toString()}
          />
          <DetailRow
            label="Created"
            value={
              tenant.createdAtUtc
                ? new Date(tenant.createdAtUtc).toLocaleString()
                : "—"
            }
          />
          <DetailRow label="Billing email" value={tenant.billingEmail || "—"} />
        </DetailCard>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Users ({users.length})
          </h2>
        </div>
        {users.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-slate-600">
            No users found for this tenant.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-slate-600">Name</th>
                    <th className="px-4 py-2 text-left font-semibold text-slate-600">Email</th>
                    <th className="px-4 py-2 text-left font-semibold text-slate-600">Role</th>
                    <th className="px-4 py-2 text-left font-semibold text-slate-600">Status</th>
                    <th className="px-4 py-2 text-left font-semibold text-slate-600">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedUsers.map((u) => (
                    <tr key={u.id} className="text-slate-800">
                      <td className="px-4 py-2">{u.name || "—"}</td>
                      <td className="px-4 py-2">{u.email}</td>
                      <td className="px-4 py-2 capitalize">{u.role}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            u.isDisabled ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {u.isDisabled ? "Disabled" : "Active"}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-500">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalUserPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
                <span>
                  Showing {userStart + 1}-{Math.min(users.length, userStart + userPageSize)} of {users.length} users
                </span>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-md border border-slate-200 px-3 py-1 font-medium text-slate-700 disabled:opacity-50"
                    disabled={currentUserPage <= 1}
                    onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                  >
                    Prev
                  </button>
                  <span>
                    Page {currentUserPage} / {totalUserPages}
                  </span>
                  <button
                    className="rounded-md border border-slate-200 px-3 py-1 font-medium text-slate-700 disabled:opacity-50"
                    disabled={currentUserPage >= totalUserPages}
                    onClick={() => setUserPage((p) => Math.min(totalUserPages, p + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function DetailCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm text-slate-700">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900 text-right ml-2">
        {value}
      </span>
    </div>
  );
}
