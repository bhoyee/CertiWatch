"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "../../lib/api";

type TenantPlanDto = {
  tenantName: string;
  planId: string;
  planName: string;
  recordLimit: number;
  recordCount: number;
  deviceCount: number;
  sourceCount: number;
  subscriptionStatus?: string | null;
  currentPeriodEndUtc?: string | null;
};

export function PlanBanner() {
  const [plan, setPlan] = useState<TenantPlanDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<TenantPlanDto>("/api/tenant/me")
      .then(setPlan)
      .catch((err) => setError(err.message ?? "Failed to load plan"));
  }, []);

  if (error) {
    return (
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {error}
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="mb-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
        Loading plan...
      </div>
    );
  }

  const nearLimit = plan.recordLimit > 0 && plan.recordCount >= plan.recordLimit * 0.8;

  return (
    <div className="mb-4 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">Current plan</p>
          <p className="text-lg font-semibold text-slate-900">
            {plan.planName} <span className="text-sm font-normal text-slate-500">({plan.tenantName})</span>
          </p>
          <p className="text-sm text-slate-600">
            Records: {plan.recordCount}
            {plan.recordLimit > 0 ? ` / ${plan.recordLimit} limit` : " (no limit)"} · Devices: {plan.deviceCount} · Sources:{" "}
            {plan.sourceCount}
          </p>
          {plan.subscriptionStatus && (
            <p className="text-xs text-slate-500">
              Status: {plan.subscriptionStatus.replace("-", " ")}{" "}
              {plan.currentPeriodEndUtc && `· Renews ${new Date(plan.currentPeriodEndUtc).toLocaleDateString()}`}
            </p>
          )}
        </div>
        <a
          className="inline-flex items-center justify-center rounded-md border border-blue-600 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          href="/plan"
        >
          {nearLimit ? "Upgrade plan" : "Manage plan"}
        </a>
      </div>
      {nearLimit && (
        <p className="mt-2 text-sm text-amber-700">
          You are approaching your record limit. Consider upgrading to avoid interruptions.
        </p>
      )}
    </div>
  );
}
