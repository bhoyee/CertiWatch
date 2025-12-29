'use client';

import { useState, useTransition } from "react";
import { postJson } from "../../../../../lib/api";

type ApiKey = { id: string; name: string; key: string; isRevoked: boolean; createdAt: string };

export function ApiKeysClient({ tenantId, initialKeys }: { tenantId: string; initialKeys: ApiKey[] }) {
  const [keys, setKeys] = useState<ApiKey[]>(initialKeys);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  const create = () => {
    if (!name.trim()) return;
    startTransition(async () => {
      const res = await postJson<ApiKey, { name: string }>(`/api/platform/tenants/${tenantId}/api-keys`, { name });
      if (res) {
        setKeys((k) => [res, ...k]);
        setName("");
      }
    });
  };

  const revoke = (keyId: string) => {
    startTransition(async () => {
      await fetch(`/api/api-keys/${keyId}/revoke`, { method: "POST", credentials: "include" });
      setKeys((k) => k.map((item) => (item.id === keyId ? { ...item, isRevoked: true } : item)));
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 px-4 pt-4">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Key name (e.g., backoffice sync)"
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
        />
        <button
          onClick={create}
          disabled={pending}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800 disabled:opacity-60"
        >
          {pending ? "Creating..." : "Create key"}
        </button>
      </div>
      <div className="divide-y divide-slate-100">
        <div className="grid grid-cols-[1.2fr,1fr,1fr,120px] gap-3 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>Name</span>
          <span>Key</span>
          <span>Created</span>
          <span className="text-right">Action</span>
        </div>
        {keys.length === 0 && <div className="px-4 py-3 text-sm text-slate-600">No API keys yet.</div>}
        {keys.map((k) => (
          <div key={k.id} className="grid grid-cols-[1.2fr,1fr,1fr,120px] items-center gap-3 px-4 py-3 text-sm text-slate-800">
            <span className="truncate">{k.name}</span>
            <span className={`truncate font-mono text-xs ${k.isRevoked ? "text-slate-400 line-through" : ""}`}>{k.key}</span>
            <span>{new Date(k.createdAt).toLocaleString()}</span>
            <span className="text-right">
              <button
                onClick={() => revoke(k.id)}
                disabled={k.isRevoked || pending}
                className="rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {k.isRevoked ? "Revoked" : "Revoke"}
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
