import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchJson } from "../../lib/api";

export default async function PlatformTenantsPage() {
  const tenants = await getTenants();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Platform – Tenants</h1>
        <p className="text-slate-600">Superadmin view of all tenants.</p>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-7 gap-3 border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>Name</span>
          <span>Plan</span>
          <span>Status</span>
          <span>Records</span>
          <span>Users</span>
          <span>Created</span>
          <span></span>
        </div>
        {tenants.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-slate-600">No tenants found.</div>
        )}
        {tenants.map((t) => (
          <div key={t.id} className="grid grid-cols-7 gap-3 border-b border-slate-100 px-4 py-3 text-sm text-slate-800">
            <span className="font-semibold text-slate-900">{t.name}</span>
            <span>{t.plan}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              t.subscriptionStatus?.toLowerCase() === "active" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
            }`}>
              {t.subscriptionStatus ?? "unknown"}
            </span>
            <span>{t.recordCount}</span>
            <span>{t.userCount}</span>
            <span>{new Date(t.createdAtUtc).toLocaleDateString()}</span>
            <span className="text-right">
              <Link
                href={`/platform/tenants/${t.id}`}
                className="rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                View
              </Link>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

type Tenant = {
  id: string;
  name: string;
  plan: string;
  createdAtUtc: string;
  subscriptionStatus?: string | null;
  recordCount: number;
  userCount: number;
};

async function getTenants(): Promise<Tenant[]> {
  try {
    return await fetchJson<Tenant[]>("/api/platform/tenants");
  } catch (e: any) {
    if (e?.status === 403) notFound();
    throw e;
  }
}
