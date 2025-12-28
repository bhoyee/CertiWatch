import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchJson } from "../../../../../lib/api";
import { ActionButtons, SendLinkButton } from "./ClientActions";

type TenantDetail = {
  id: string;
  name: string;
  plan: string;
  billingEmail?: string | null;
  createdAtUtc: string;
  subscriptionStatus?: string | null;
  currentPeriodEndUtc?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  recordCount: number;
  userCount: number;
  deviceCount: number;
  sourceCount: number;
  users: { id: string; email: string; name?: string | null; role: string; isDisabled: boolean; createdAt: string }[];
  devices: { id: string; name: string; status: string; createdAt: string; lastSeenAt?: string | null }[];
  sources: { id: string; displayName: string; type: string; createdAt: string }[];
  recentRecords: {
    id: string;
    staffName?: string | null;
    courseName?: string | null;
    issuer?: string | null;
    processingStatus: number;
    createdAt: string;
  }[];
};

async function getTenant(id: string): Promise<TenantDetail> {
  try {
    return await fetchJson<TenantDetail>(`/api/platform/tenants/${id}`);
  } catch (e: any) {
    if (e?.status === 404 || e?.status === 403) notFound();
    throw e;
  }
}

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString() : "—");

export default async function TenantDetailPage({ params }: { params: { id: string } }) {
  const tenant = await getTenant(params.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Platform / Tenants</p>
          <h1 className="text-2xl font-semibold text-slate-900">{tenant.name}</h1>
          <p className="text-slate-600">Plan: {tenant.plan}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/platform/tenants"
            className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            ← Back to tenants
          </Link>
          <ActionButtons
            tenantId={tenant.id}
            isSuspended={(tenant.subscriptionStatus ?? "").toLowerCase() === "suspended"}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Subscription status" value={tenant.subscriptionStatus ?? "unknown"} tone="amber" />
        <StatCard label="Renewal / Period end" value={formatDate(tenant.currentPeriodEndUtc)} />
        <StatCard label="Billing email" value={tenant.billingEmail ?? "—"} />
        <StatCard label="Records" value={tenant.recordCount.toLocaleString()} />
        <StatCard label="Users" value={tenant.userCount.toLocaleString()} />
        <StatCard label="Devices" value={tenant.deviceCount.toLocaleString()} />
        <StatCard label="Sources" value={tenant.sourceCount.toLocaleString()} />
        <StatCard label="Created" value={formatDate(tenant.createdAtUtc)} />
        <StatCard label="Stripe Customer" value={tenant.stripeCustomerId ?? "—"} />
      </div>

      <Section title="Users">
        <UsersTable tenantId={tenant.id} users={tenant.users} />
      </Section>

      <Section title="Devices">
        <SimpleTable
          headers={["Name", "Status", "Created", "Last seen"]}
          rows={tenant.devices.map((d) => [
            d.name,
            d.status,
            new Date(d.createdAt).toLocaleString(),
            d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : "—"
          ])}
        />
      </Section>

      <Section title="Sources">
        <SimpleTable
          headers={["Name", "Type", "Created"]}
          rows={tenant.sources.map((s) => [s.displayName, s.type, new Date(s.createdAt).toLocaleString()])}
        />
      </Section>

      <Section title="Recent records">
        <SimpleTable
          headers={["Staff", "Course", "Issuer", "Status", "Created"]}
          rows={tenant.recentRecords.map((r) => [
            r.staffName ?? "—",
            r.courseName ?? "—",
            r.issuer ?? "—",
            formatStatus(r.processingStatus),
            new Date(r.createdAt).toLocaleString()
          ])}
        />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">{children}</div>
    </div>
  );
}

function UsersTable({ users, tenantId }: { users: TenantDetail["users"]; tenantId: string }) {
  if (users.length === 0) return <div className="px-4 py-3 text-sm text-slate-600">No users.</div>;
  return (
    <div className="divide-y divide-slate-100">
      <div className="grid grid-cols-6 gap-3 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <span>Name</span>
        <span>Email</span>
        <span>Role</span>
        <span>Status</span>
        <span>Created</span>
        <span></span>
      </div>
      {users.map((u) => (
        <div key={u.id} className="grid grid-cols-6 gap-3 px-4 py-3 text-sm text-slate-800">
          <span className="font-semibold text-slate-900">{u.name ?? "—"}</span>
          <span className="truncate">{u.email}</span>
          <span className="capitalize">{u.role}</span>
          <span className={u.isDisabled ? "text-amber-700" : "text-emerald-700"}>{u.isDisabled ? "disabled" : "active"}</span>
          <span>{new Date(u.createdAt).toLocaleDateString()}</span>
          <span className="text-right">
            <SendLinkButton tenantId={tenantId} userId={u.id} />
          </span>
        </div>
      ))}
    </div>
  );
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <div className="divide-y divide-slate-100">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {headers.map((h) => (
          <span key={h}>{h}</span>
        ))}
      </div>
      {rows.length === 0 && <div className="px-4 py-3 text-sm text-slate-600">No data.</div>}
      {rows.map((r, idx) => (
        <div key={idx} className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3 px-4 py-3 text-sm text-slate-800">
          {r.map((c, i) => (
            <span key={i} className="truncate">
              {c}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function formatStatus(status: number) {
  const map: Record<number, string> = { 0: "pending", 1: "ok", 2: "needs review" };
  return map[status] ?? "unknown";
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "amber" | "emerald" }) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-700 bg-emerald-50"
      : tone === "amber"
        ? "text-amber-700 bg-amber-50"
        : "text-slate-900 bg-white";
  return (
    <div className={`rounded-xl border border-slate-200 px-4 py-3 shadow-sm ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}
