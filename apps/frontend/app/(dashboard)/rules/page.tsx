"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "../../../lib/api";

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

export default function RulesPage() {
  const [rules, setRules] = useState<RuleDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<RuleDto[]>("/api/course-rules")
      .then(setRules)
      .catch((err) => setError(err.message ?? "Failed to load rules"));
  }, []);

  if (error) return <ErrorCard message={error} />;
  if (!rules) return <LoadingCard />;

  return (
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
  );
}

function Header({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">{children}</th>;
}

function Cell({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 text-slate-800">{children}</td>;
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
