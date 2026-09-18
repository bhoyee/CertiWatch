'use client';

import { useState, useTransition } from "react";
import { postJson } from "@/lib/api";

export function ActionButtons({ tenantId, isSuspended }: { tenantId: string; isSuspended: boolean }) {
  const [pending, startTransition] = useTransition();
  const [localSuspended, setLocalSuspended] = useState(isSuspended);
  const [error, setError] = useState<string | null>(null);

  // Was a bare fetch("/api/...") - a relative path that hits the Next.js server itself (no
  // rewrite/proxy is configured for /api/*), not the actual API on its own origin. It 404'd
  // silently every time (the response was never checked) and the page still reloaded, so the
  // button looked like it "did nothing" - postJson resolves against the real API base URL and
  // throws on a failed request instead of pretending it worked.
  function call(action: "suspend" | "resume" | "reset-subscription") {
    setError(null);
    startTransition(async () => {
      try {
        await postJson(`/api/platform/tenants/${tenantId}/${action}`, {});
        if (action === "suspend") setLocalSuspended(true);
        if (action === "resume") setLocalSuspended(false);
        // reset-subscription is fire-and-forget
        window.location.reload();
      } catch (err: any) {
        setError(err?.message ?? `Failed to ${action.replace("-", " ")}`);
      }
    });
  }

  return (
    <div>
      <div className="flex gap-2">
        <button
          onClick={() => call("reset-subscription")}
          disabled={pending}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {pending ? "Resetting..." : "Reset subscription"}
        </button>
        {localSuspended ? (
          <button
            onClick={() => call("resume")}
            disabled={pending}
            className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
          >
            {pending ? "Resuming..." : "Resume tenant"}
          </button>
        ) : (
          <button
            onClick={() => call("suspend")}
            disabled={pending}
            className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-60"
          >
            {pending ? "Suspending..." : "Suspend tenant"}
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-rose-700">{error}</p>}
    </div>
  );
}

// Lets a superadmin give a tenant free access for a fixed window - independent of Stripe - for
// pilot organizations trying CertiWatch before they commit to paying. Granting again just
// replaces the end date rather than stacking, which is simpler for an admin to reason about than
// tracking cumulative extensions.
export function PilotAccessControls({ tenantId, pilotAccessUntilUtc }: { tenantId: string; pilotAccessUntilUtc: string | null }) {
  const [pending, startTransition] = useTransition();
  const [days, setDays] = useState("30");
  const [until, setUntil] = useState<string | null>(pilotAccessUntilUtc);
  const [error, setError] = useState<string | null>(null);

  const isActive = until !== null && new Date(until).getTime() > Date.now();

  const grant = (presetDays?: number) => {
    const parsed = presetDays ?? Number(days);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 730) {
      setError("Enter a whole number of days between 1 and 730.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const res = await postJson<{ pilotAccessUntilUtc: string }, Record<string, unknown>>(
          `/api/platform/tenants/${tenantId}/grant-pilot-access`,
          { days: parsed }
        );
        setUntil(res.pilotAccessUntilUtc);
      } catch (err: any) {
        setError(err?.message ?? "Failed to grant pilot access");
      }
    });
  };

  const clear = () => {
    startTransition(async () => {
      try {
        await postJson(`/api/platform/tenants/${tenantId}/clear-pilot-access`, {});
        setUntil(null);
      } catch (err: any) {
        setError(err?.message ?? "Failed to clear pilot access");
      }
    });
  };

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
      <h3 className="text-sm font-semibold text-indigo-900">Pilot access</h3>
      <p className="mt-1 text-xs text-indigo-700">
        Grant free access for a fixed window, independent of any Stripe subscription - for an
        organization trying CertiWatch before they commit to paying.
      </p>
      <p className="mt-2 text-sm font-medium text-indigo-900">
        {isActive && until ? `Active until ${new Date(until).toLocaleString()}` : "No pilot access granted"}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => grant(7)}
          disabled={pending}
          className="rounded-md border border-indigo-300 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
        >
          1 week
        </button>
        <button
          onClick={() => grant(30)}
          disabled={pending}
          className="rounded-md border border-indigo-300 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
        >
          1 month
        </button>
        <button
          onClick={() => grant(90)}
          disabled={pending}
          className="rounded-md border border-indigo-300 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
        >
          3 months
        </button>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={1}
            max={730}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="w-20 rounded-md border border-indigo-300 px-2 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
          />
          <span className="text-xs text-indigo-700">days</span>
          <button
            onClick={() => grant()}
            disabled={pending}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            {pending ? "Granting..." : "Grant"}
          </button>
        </div>
        {isActive && (
          <button
            onClick={clear}
            disabled={pending}
            className="rounded-md border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
          >
            Clear
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-rose-700">{error}</p>}
    </div>
  );
}

export function SendLinkButton({ tenantId, userId }: { tenantId: string; userId: string }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);

  const send = () => {
    start(async () => {
      setDone(false);
      const res = await postJson<{ success: boolean }, Record<string, never>>(
        `/api/platform/tenants/${tenantId}/users/${userId}/magic-link`,
        {}
      );
      if (res?.success) setDone(true);
    });
  };

  return (
    <button
      onClick={send}
      disabled={pending}
      className="rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
    >
      {pending ? "Sending..." : done ? "Link sent" : "Send login link"}
    </button>
  );
}

export function UserStatusButtons({ tenantId, userId, isDisabled }: { tenantId: string; userId: string; isDisabled: boolean }) {
  const [pending, start] = useTransition();
  const [localDisabled, setLocalDisabled] = useState(isDisabled);

  // Same relative-URL bug as ActionButtons.call above - fixed the same way.
  const call = (action: "disable" | "enable" | "force-reset") => {
    start(async () => {
      await postJson(`/api/platform/tenants/${tenantId}/users/${userId}/${action}`, {});
      if (action === "disable") setLocalDisabled(true);
      if (action === "enable") setLocalDisabled(false);
    });
  };

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <button
        onClick={() => call("force-reset")}
        disabled={pending}
        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        Force reset
      </button>
      {localDisabled ? (
        <button
          onClick={() => call("enable")}
          disabled={pending}
          className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
        >
          Enable
        </button>
      ) : (
        <button
          onClick={() => call("disable")}
          disabled={pending}
          className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-60"
        >
          Disable
        </button>
      )}
    </div>
  );
}
