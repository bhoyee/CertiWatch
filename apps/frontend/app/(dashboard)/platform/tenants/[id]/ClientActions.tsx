'use client';

import { useState, useTransition } from "react";
import { postJson } from "../../../../../lib/api";

export function ActionButtons({ tenantId, isSuspended }: { tenantId: string; isSuspended: boolean }) {
  const [pending, startTransition] = useTransition();
  const [localSuspended, setLocalSuspended] = useState(isSuspended);

  async function call(action: "suspend" | "resume" | "reset-subscription") {
    startTransition(async () => {
      await fetch(`/api/platform/tenants/${tenantId}/${action}`, { method: "POST", credentials: "include" });
      if (action === "suspend") setLocalSuspended(true);
      if (action === "resume") setLocalSuspended(false);
      if (action === "reset-subscription") {
        // no-op
      }
      window.location.reload();
    });
  }

  return (
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
