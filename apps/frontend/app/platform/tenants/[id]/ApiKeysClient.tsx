'use client';

import { useState } from "react";
import { postJson } from "../../../../lib/api";

type ApiKey = { id: string; name: string; key: string; isRevoked: boolean; createdAt: string };

export function ApiKeysClient({ tenantId, initialKeys }: { tenantId: string; initialKeys: ApiKey[] }) {
  const [keys, setKeys] = useState<ApiKey[]>(initialKeys);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);

  const create = async () => {
    if (!name.trim()) return;
    setPending(true);
    const res = await postJson<ApiKey, { name: string }>(`/api/platform/tenants/${tenantId}/api-keys`, { name });
    if (res) setKeys((k) => [res, ...k]);
    setName("");
    setPending(false);
  };

  const revoke = async (id: string) => {
    setPending(true);
    await fetch(`/api/platform/tenants/${tenantId}/api-keys/${id}/revoke`, { method: "POST", credentials: "include" });
    setKeys((k) => k.map((a) => (a.id === id ? { ...a, isRevoked: true } : a)));
    setPending(false);
  };

  return (
    <div className="divide-y divide-slate-100">
      <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Create API key</label>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Key name"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
            <button
              onClick={create}
              disabled={pending}
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {pending ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        <div className="grid grid-cols-5 gap-3 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>Name</span>
          <span>Key</span>
          <span>Status</span>
          <span>Created</span>
          <span></span>
        </div>
        {keys.length === 0 && <div className="px-4 py-3 text-sm text-slate-600">No API keys.</div>}
        {keys.map((k) => (
          <div key={k.id} className="grid grid-cols-5 gap-3 px-4 py-3 text-sm text-slate-800">
            <span className="font-semibold">{k.name}</span>
            <span className="truncate">{k.key}</span>
            <span className={k.isRevoked ? "text-amber-700" : "text-emerald-700"}>{k.isRevoked ? "revoked" : "active"}</span>
            <span>{new Date(k.createdAt).toLocaleString()}</span>
            <span className="text-right">
              {!k.isRevoked && (
                <button
                  onClick={() => revoke(k.id)}
                  disabled={pending}
                  className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                >
                  Revoke
                </button>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
