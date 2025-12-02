"use client";

import { useEffect, useState } from "react";
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

  if (error) return <ErrorCard message={error} />;
  if (!rules) return <LoadingCard />;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4">
          <h1 className="text-lg font-semibold text-slate-900">Rules</h1>
          <p className="text-sm text-slate-600">Tenant and global course rules.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <Header>Course</Header>
                <Header>Issuer</Header>
                <Header>Validity (months)</Header>
                <Header>Renewable</Header>
                <Header>Scope</Header>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rules.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <Cell>{r.courseName}</Cell>
                  <Cell>{r.issuerOverride ?? "Any"}</Cell>
                  <Cell>{r.defaultValidityMonths ?? "—"}</Cell>
                  <Cell>{r.isRenewable ? "Yes" : "No"}</Cell>
                  <Cell>{r.tenantId ? "Tenant" : "Global"}</Cell>
                </tr>
              ))}
            </tbody>
          </table>
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

function Header({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">{children}</th>;
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
