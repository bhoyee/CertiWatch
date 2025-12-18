"use client";

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

export function PlanBanner({
  plan,
  error,
  loading,
  onPayNow
}: {
  plan: TenantPlanDto | null;
  error: string | null;
  loading: boolean;
  onPayNow: () => Promise<void>;
}) {
  if (error) {
    return (
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {error}
      </div>
    );
  }

  if (loading || !plan) {
    return (
      <div className="mb-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
        Loading plan...
      </div>
    );
  }

  const isActive = isSubscriptionActive(plan.subscriptionStatus, plan.currentPeriodEndUtc);
  const nearLimit = plan.recordLimit > 0 && plan.recordCount >= plan.recordLimit * 0.8;

  return (
    <div className={`mb-4 rounded-lg border px-4 py-3 shadow-sm ${isActive ? "border-slate-200 bg-white" : "border-rose-200 bg-rose-50"}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">Current plan</p>
          <p className="text-lg font-semibold text-slate-900">
            {plan.planName} <span className="text-sm font-normal text-slate-500">({plan.tenantName})</span>
          </p>
          <p className="text-sm text-slate-600">
            Records: {plan.recordCount}
            {plan.recordLimit > 0 ? ` / ${plan.recordLimit} limit` : " (no limit)"}  -  Devices: {plan.deviceCount}  -  Sources:{" "}
            {plan.sourceCount}
          </p>
          {plan.subscriptionStatus && (
            <p className="text-xs text-slate-500">
              Status: {plan.subscriptionStatus.replace("-", " ")}{" "}
              {plan.currentPeriodEndUtc && ` -  Renews ${new Date(plan.currentPeriodEndUtc).toLocaleDateString()}`}
            </p>
          )}
          {!isActive && (
            <p className="mt-2 text-sm font-semibold text-rose-700">
              Trial expired or payment failed. Please update your billing to continue using CertiWatch.
            </p>
          )}
        </div>
        {isActive ? (
          <a
            className="inline-flex items-center justify-center rounded-md border border-blue-600 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
            href="/plan"
          >
            {nearLimit ? "Upgrade plan" : "Manage plan"}
          </a>
        ) : (
          <button
            onClick={onPayNow}
            className="inline-flex items-center justify-center rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-500"
          >
            Pay now
          </button>
        )}
      </div>
      {nearLimit && isActive && (
        <p className="mt-2 text-sm text-amber-700">
          You are approaching your record limit. Consider upgrading to avoid interruptions.
        </p>
      )}
    </div>
  );
}

function isSubscriptionActive(status?: string | null, currentPeriodEndUtc?: string | null) {
  if (!status) return true;
  const normalized = status.trim().toLowerCase();
  if (normalized === "active" || normalized === "trialing") return true;
  if (normalized === "canceled" && currentPeriodEndUtc) {
    const end = new Date(currentPeriodEndUtc);
    return !isNaN(end.getTime()) && end > new Date();
  }
  return false;
}

