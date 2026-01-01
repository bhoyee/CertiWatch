"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { fetchJson } from "../../../../lib/api";

type TenantUser = {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  isDisabled: boolean;
  createdAt?: string | null;
};

type TenantDevice = {
  id: string;
  name?: string | null;
  status?: string | null;
  createdAt?: string | null;
  lastSeenAt?: string | null;
};

type TenantSource = {
  id: string;
  displayName: string;
  type: string;
  createdAt?: string | null;
};

type TenantApiKey = {
  id: string;
  name: string;
  key: string;
  isRevoked: boolean;
  createdAt?: string | null;
};

type TenantRecord = {
  id: string;
  staffName?: string | null;
  courseName?: string | null;
  issuer?: string | null;
  processingStatus?: string | null;
  createdAt?: string | null;
};

type TenantDetail = {
  id: string;
  name: string;
  plan?: string | null;
  subscriptionStatus?: string | null;
  currentPeriodEndUtc?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  billingEmail?: string | null;
  recordCount: number;
  userCount: number;
  deviceCount: number;
  sourceCount: number;
  users: TenantUser[];
  devices: TenantDevice[];
  sources: TenantSource[];
  apiKeys: TenantApiKey[];
  recentRecords: TenantRecord[];
};

const displayText = (value?: string | null) =>
  value && value.trim().length > 0 ? value : "-";

const displayDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : "-";

const statusPill = (value?: string | null) => {
  const text = displayText(value);
  const color =
    value?.toLowerCase() === "active"
      ? "bg-emerald-100 text-emerald-700"
      : "bg-slate-100 text-slate-700";
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-medium ${color}`}>
      {text}
    </span>
  );
};

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!id) return;
    fetchJson<TenantDetail>(`/api/platform/tenants/${id}`)
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
  }, [id]);

  const cards = useMemo(
    () => [
      { label: "Users", value: tenant?.userCount ?? 0 },
      { label: "Records", value: tenant?.recordCount ?? 0 },
      { label: "Devices", value: tenant?.deviceCount ?? 0 },
      { label: "Sources", value: tenant?.sourceCount ?? 0 },
    ],
    [tenant]
  );

  if (loading) {
    return <div className="p-6 text-sm text-slate-600">Loading tenant...</div>;
  }

  if (error || !tenant) {
    return (
      <div className="p-6 text-sm text-rose-600">
        Failed to load tenant: {error ?? "not found"}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-slate-900">{tenant.name}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Plan:</span>
            {statusPill(tenant.plan ?? "unknown")}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Subscription:</span>
            {statusPill(tenant.subscriptionStatus ?? "unknown")}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Renews:</span>
            {displayDate(tenant.currentPeriodEndUtc)}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Billing email:</span>
            <span className="font-medium text-slate-900">
              {displayText(tenant.billingEmail)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="text-sm text-slate-500">{card.label}</div>
            <div className="text-2xl font-semibold text-slate-900">
              {card.value}
            </div>
          </div>
        ))}
      </div>

      <Section title="Recent records" emptyText="No recent records.">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Staff</th>
              <th className="px-3 py-2">Course</th>
              <th className="px-3 py-2">Issuer</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {tenant.recentRecords.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-3 py-2">{displayText(r.staffName)}</td>
                <td className="px-3 py-2">{displayText(r.courseName)}</td>
                <td className="px-3 py-2">{displayText(r.issuer)}</td>
                <td className="px-3 py-2">{statusPill(r.processingStatus)}</td>
                <td className="px-3 py-2">{displayDate(r.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Users" emptyText="No users found.">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {tenant.users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-900">
                  {u.email}
                </td>
                <td className="px-3 py-2">{displayText(u.name)}</td>
                <td className="px-3 py-2 capitalize text-slate-700">
                  {displayText(u.role)}
                </td>
                <td className="px-3 py-2">
                  {u.isDisabled ? (
                    <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700">
                      Disabled
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                      Active
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">{displayDate(u.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Devices" emptyText="No devices found.">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Last seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {tenant.devices.map((d) => (
              <tr key={d.id} className="hover:bg-slate-50">
                <td className="px-3 py-2">{displayText(d.name)}</td>
                <td className="px-3 py-2">{statusPill(d.status)}</td>
                <td className="px-3 py-2">{displayDate(d.createdAt)}</td>
                <td className="px-3 py-2">{displayDate(d.lastSeenAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Sources" emptyText="No sources found.">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {tenant.sources.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-3 py-2">{displayText(s.displayName)}</td>
                <td className="px-3 py-2">{displayText(s.type)}</td>
                <td className="px-3 py-2">{displayDate(s.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="API keys" emptyText="No API keys.">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Key</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {tenant.apiKeys.map((k) => (
              <tr key={k.id} className="hover:bg-slate-50">
                <td className="px-3 py-2">{displayText(k.name)}</td>
                <td className="px-3 py-2 font-mono text-xs text-slate-800">
                  {displayText(k.key)}
                </td>
                <td className="px-3 py-2">
                  {k.isRevoked ? (
                    <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700">
                      Revoked
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                      Active
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">{displayDate(k.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}

function Section({
  title,
  emptyText,
  children,
}: {
  title: string;
  emptyText: string;
  children: React.ReactNode;
}) {
  const hasRows = Array.isArray((children as any)?.props?.children) ||
    ((children as any)?.props?.children?.props?.children?.length ?? 0) > 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        {children}
        {!hasRows && (
          <div className="p-4 text-sm text-slate-600">{emptyText}</div>
        )}
      </div>
    </div>
  );
}





