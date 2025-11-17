export const dynamic = "force-dynamic";

import { fetchJson } from "../../../lib/api";

type Rule = {
  id: string;
  courseName: string;
  defaultValidityMonths?: number;
  isGlobal: boolean;
};

async function loadRules(): Promise<Rule[]> {
  try {
    return await fetchJson<Rule[]>("/api/course-rules");
  } catch {
    return [];
  }
}

export default async function RulesPage() {
  const rules = await loadRules();
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Rules</p>
        <h1 className="text-2xl font-semibold">Course Validity Rules</h1>
      </div>
      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Course
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Validity (Months)
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Scope
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td className="px-4 py-3 text-sm font-medium text-slate-900">{rule.courseName}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{rule.defaultValidityMonths ?? "--"}</td>
                <td className="px-4 py-3 text-sm">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold uppercase text-slate-600">
                    {rule.isGlobal ? "Global" : "Tenant"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
