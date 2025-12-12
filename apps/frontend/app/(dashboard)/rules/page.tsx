"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchJson, postJson } from "../../../lib/api";

type RuleDto = {
  id: string;
  tenantId: string | null;
  courseName: string;
  matchRegex: string | null;
  tag: string | null;
  issuerOverride: string | null;
  defaultValidityMonths: number | null;
  isRenewable: boolean;
  isOneTime: boolean;
  priority: number;
  isGlobal: boolean;
};

type CreateRule = {
  courseName: string;
  matchRegex: string;
  issuerOverride: string;
  defaultValidityMonths: string;
  isRenewable: boolean;
  isOneTime: boolean;
  tag: string;
};

export default function RulesPage() {
  const [rules, setRules] = useState<RuleDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState<"all" | "global" | "tenant">("all");
  const [sort, setSort] = useState<{ key: "course" | "issuer" | "validity" | "scope"; dir: "asc" | "desc" }>({
    key: "course",
    dir: "asc"
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [form, setForm] = useState<CreateRule>({
    courseName: "",
    matchRegex: "",
    issuerOverride: "",
    defaultValidityMonths: "",
    isRenewable: false,
    isOneTime: false,
    tag: ""
  });

  useEffect(() => {
    fetchJson<RuleDto[]>("/api/course-rules")
      .then(setRules)
      .catch((err) => setError(err.message ?? "Failed to load rules"));
  }, []);

  const filtered = useMemo(() => {
    if (!rules) return [];
    const term = search.trim().toLowerCase();
    return rules.filter((r) => {
      if (scopeFilter === "global" && !r.isGlobal) return false;
      if (scopeFilter === "tenant" && r.isGlobal) return false;
      if (!term) return true;
      return (
        r.courseName.toLowerCase().includes(term) ||
        (r.issuerOverride ?? "").toLowerCase().includes(term) ||
        (r.tag ?? "").toLowerCase().includes(term)
      );
    });
  }, [rules, scopeFilter, search]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      switch (sort.key) {
        case "course":
          return a.courseName.localeCompare(b.courseName) * dir;
        case "issuer":
          return (a.issuerOverride ?? "Any").localeCompare(b.issuerOverride ?? "Any") * dir;
        case "validity":
          return ((a.defaultValidityMonths ?? 0) - (b.defaultValidityMonths ?? 0)) * dir;
        case "scope":
          return (a.isGlobal === b.isGlobal ? 0 : a.isGlobal ? -1 : 1) * dir;
        default:
          return 0;
      }
    });
    return list;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const visible = sorted.slice(start, start + pageSize);

  const setSortKey = (key: typeof sort.key) => {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  };

  if (error) return <ErrorCard message={error} />;
  if (!rules) return <LoadingCard />;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Rules</h1>
            <p className="text-sm text-slate-600">Tenant and global course rules.</p>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search course, issuer, tag..."
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none md:w-64"
            />
            <select
              value={scopeFilter}
              onChange={(e) => {
                setScopeFilter(e.target.value as any);
                setPage(1);
              }}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All scopes</option>
              <option value="global">Global</option>
              <option value="tenant">Tenant</option>
            </select>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              {[10, 25, 50].map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <Header onClick={() => setSortKey("course")} sorted={sort.key === "course"} dir={sort.dir}>
                  Course
                </Header>
                <Header onClick={() => setSortKey("issuer")} sorted={sort.key === "issuer"} dir={sort.dir}>
                  Issuer
                </Header>
                <Header onClick={() => setSortKey("validity")} sorted={sort.key === "validity"} dir={sort.dir}>
                  Validity (months)
                </Header>
                <Header>Renewable</Header>
                <Header>Tag</Header>
                <Header onClick={() => setSortKey("scope")} sorted={sort.key === "scope"} dir={sort.dir}>
                  Scope
                </Header>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {visible.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <Cell>{r.courseName}</Cell>
                  <Cell>{r.issuerOverride ?? "Any"}</Cell>
                  <Cell>{r.defaultValidityMonths ?? "--"}</Cell>
                  <Cell>{r.isRenewable ? "Yes" : "No"}</Cell>
                  <Cell>{r.tag ?? "--"}</Cell>
                  <Cell>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        r.isGlobal ? "bg-emerald-600 text-white" : "bg-slate-900 text-white"
                      }`}
                    >
                      {r.isGlobal ? "Global" : "Tenant"}
                    </span>
                  </Cell>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-sm text-slate-500">
                    No rules match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-col gap-2 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
          <span>
            Showing {sorted.length === 0 ? 0 : start + 1}–{Math.min(sorted.length, start + pageSize)} of {sorted.length}{" "}
            rules
          </span>
          <div className="flex items-center gap-2">
            <button
              className="rounded-md border border-slate-200 px-3 py-1 text-sm font-medium text-slate-700 disabled:opacity-50"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            <span className="text-slate-700">
              Page {currentPage} / {totalPages}
            </span>
            <button
              className="rounded-md border border-slate-200 px-3 py-1 text-sm font-medium text-slate-700 disabled:opacity-50"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-md font-semibold text-slate-900">Add a rule</h2>
        <p className="text-sm text-slate-600">Use a regex to match course text, optionally override issuer and validity.</p>
        <form
          className="mt-4 grid gap-4 md:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setCreating(true);
            setError(null);
            try {
              const body: any = {
                courseName: form.courseName.trim(),
                matchRegex: form.matchRegex.trim() || null,
                issuerOverride: form.issuerOverride.trim() || null,
                defaultValidityMonths: form.defaultValidityMonths ? Number(form.defaultValidityMonths) : null,
                isRenewable: form.isRenewable,
                isOneTime: form.isOneTime,
                tag: form.tag.trim() || null
              };
              await postJson("/api/course-rules", body);
              const refreshed = await fetchJson<RuleDto[]>("/api/course-rules");
              setRules(refreshed);
              setForm({
                courseName: "",
                matchRegex: "",
                issuerOverride: "",
                defaultValidityMonths: "",
                isRenewable: false,
                isOneTime: false,
                tag: ""
              });
            } catch (err: any) {
              setError(err.message ?? "Failed to create rule");
            } finally {
              setCreating(false);
            }
          }}
        >
          <Field
            label="Course name"
            required
            value={form.courseName}
            onChange={(v) => setForm({ ...form, courseName: v })}
            placeholder="Autism Awareness: Level 2"
          />
          <Field
            label="Match regex"
            value={form.matchRegex}
            onChange={(v) => setForm({ ...form, matchRegex: v })}
            placeholder="Autism\\s+Awareness"
          />
          <Field
            label="Issuer override"
            value={form.issuerOverride}
            onChange={(v) => setForm({ ...form, issuerOverride: v })}
            placeholder="Hull City Council"
          />
          <Field
            label="Validity (months)"
            value={form.defaultValidityMonths}
            onChange={(v) => setForm({ ...form, defaultValidityMonths: v })}
            placeholder="24"
            type="number"
          />
          <Checkbox
            label="Renewable"
            checked={form.isRenewable}
            onChange={(v) => setForm({ ...form, isRenewable: v })}
          />
          <Checkbox label="One-time" checked={form.isOneTime} onChange={(v) => setForm({ ...form, isOneTime: v })} />
          <Field label="Tag" value={form.tag} onChange={(v) => setForm({ ...form, tag: v })} placeholder="training" />
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={creating || !form.courseName.trim()}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
            >
              {creating ? "Saving..." : "Save rule"}
            </button>
            {error && <span className="ml-3 text-sm text-rose-700">{error}</span>}
          </div>
        </form>
      </div>
    </div>
  );
}

function Header({
  children,
  onClick,
  sorted,
  dir
}: {
  children: React.ReactNode;
  onClick?: () => void;
  sorted?: boolean;
  dir?: "asc" | "desc";
}) {
  return (
    <th
      className={`px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 ${
        onClick ? "cursor-pointer select-none" : ""
      }`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      <div className="flex items-center gap-1">
        <span>{children}</span>
        {sorted && <span className="text-slate-400">{dir === "asc" ? "▲" : "▼"}</span>}
      </div>
    </th>
  );
}

function Cell({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 text-slate-800">{children}</td>;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-rose-600"> *</span>}
      </label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
      />
    </div>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center space-x-2 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
      />
      <span>{label}</span>
    </label>
  );
}

function LoadingCard() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">Loading rules…</div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
      Failed to load rules: {message}
    </div>
  );
}
