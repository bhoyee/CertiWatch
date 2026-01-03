"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchJson } from "../../../lib/api";

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
};

export default function TenantDetailPage() {
  const params = useParams();
  const tenantId = params?.id as string | undefined;

  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
