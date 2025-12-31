"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { fetchJson } from "../../../../lib/api";

type TenantUserDto = {
  id: string;
  email: string;
  role: string;
  name?: string | null;
};

type TenantRecordDto = {
  id: string;
  staffName: string | null;
  courseName: string | null;
  issueDate: string | null;
  createdAt: string;
};

type TenantDetailDto = {
  id: string;
  name: string;
  plan: string;
  subscriptionStatus: string;
  records: number;
  users: number;
  sources: number;
  usersList: TenantUserDto[];
  recentRecords: TenantRecordDto[];
};

export default function TenantDetailPage() {
  const params = useParams();
  const tenantId = params?.id as string | undefined;

  const [data, setData] = useState<TenantDetailDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    fetchJson<TenantDetailDto>(`/api/platform/tenants/${tenantId}`)
      .then(setData)
      .catch((e) => {
        console.error(e);
        setError("Failed to load tenant details");
      })
      .finally(() => setLoading(false));
  }, [tenantId]);

  const title = useMemo(() => data?.name ?? "Tenant", [data]);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-4">Loading tenant...</h1>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-2">Tenant</h1>
        <p className="text-red-600">{error ?? "Tenant not found."}</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-slate-600">Plan: {data.plan}</p>
        <p className="text-sm text-slate-600">
          Subscription: {data.subscriptionStatus}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Users" value={data.users} />
        <StatCard label="Records" value={data.records} />
        <StatCard label="Sources" value={data.sources} />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Users</h2>
        <div className="overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Name</th>
              </tr>
            </thead>
            <tbody>
              {data.usersList.length === 0 && (
                <tr>
                  <td className="px-4 py-3 text-slate-500" colSpan={3}>
                    No users.
                  </td>
                </tr>
              )}
              {data.usersList.map((u) => (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">{u.email}</td>
                  <td className="px-4 py-2 uppercase">{u.role}</td>
                  <td className="px-4 py-2">{u.name || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recent records</h2>
        <div className="overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-2">Staff</th>
                <th className="px-4 py-2">Course</th>
                <th className="px-4 py-2">Issued</th>
                <th className="px-4 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {data.recentRecords.length === 0 && (
                <tr>
                  <td className="px-4 py-3 text-slate-500" colSpan={4}>
                    No records.
                  </td>
                </tr>
              )}
              {data.recentRecords.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">{r.staffName || "—"}</td>
                  <td className="px-4 py-2">{r.courseName || "—"}</td>
                  <td className="px-4 py-2">{r.issueDate || "—"}</td>
                  <td className="px-4 py-2">{new Date(r.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-600">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}
