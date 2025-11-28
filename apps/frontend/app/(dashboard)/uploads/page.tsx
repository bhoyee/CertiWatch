"use client";

import { useEffect, useState } from "react";
import { fetchJson, postJson } from "../../../lib/api";

type UploadHistoryItem = {
  id: string;
  staffName?: string;
  staffEmail?: string;
  status: string;
  createdAt: string;
  usedAt?: string;
  expiresAt: string;
};

type CreateResponse = { token: string; link: string; expiresAt: string };

type FormState = {
  staffName: string;
  staffEmail: string;
  expiryDate: string;
};

export default function UploadsPage() {
  const [history, setHistory] = useState<UploadHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>({ staffName: "", staffEmail: "", expiryDate: "" });
  const [lastLink, setLastLink] = useState<CreateResponse | null>(null);

  const loadHistory = () => {
    fetchJson<UploadHistoryItem[]>("/api/uploads/history")
      .then(setHistory)
      .catch((err) => setError(err.message ?? "Failed to load history"));
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const body: Record<string, any> = {
        staffName: form.staffName || null,
        staffEmail: form.staffEmail || null,
        expiryDate: form.expiryDate ? form.expiryDate : null
      };
      const res = await postJson<CreateResponse, typeof body>("/api/uploads/requests", body);
      setLastLink(res);
      loadHistory();
    } catch (err: any) {
      setError(err.message ?? "Failed to create upload link");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Create upload link</h1>
        <p className="text-sm text-slate-600">Generate a one-time link for staff to submit a certificate. Expiry is optional.</p>
        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={submit}>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Staff name</label>
            <input
              type="text"
              value={form.staffName}
              onChange={(e) => setForm({ ...form, staffName: e.target.value })}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="Jane Doe"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Staff email</label>
            <input
              type="email"
              value={form.staffEmail}
              onChange={(e) => setForm({ ...form, staffEmail: e.target.value })}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="jane@example.com"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Expiry hint (optional)</label>
            <input
              type="date"
              value={form.expiryDate}
              onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="md:col-span-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={creating}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
            >
              {creating ? "Creating..." : "Create link"}
            </button>
            {lastLink && (
              <div className="text-xs text-slate-700">
                Link: <a className="text-blue-600 underline" href={lastLink.link}>{lastLink.link}</a> (expires {new Date(lastLink.expiresAt).toLocaleString()})
              </div>
            )}
          </div>
          {error && (
            <div className="md:col-span-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}
        </form>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Recent uploads</h2>
          <button
            onClick={loadHistory}
            className="rounded-md border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-700 hover:border-slate-300"
          >
            Refresh
          </button>
        </div>
        <div className="-mx-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <Header>Staff</Header>
                <Header>Email</Header>
                <Header>Status</Header>
                <Header>Created</Header>
                <Header>Used</Header>
                <Header>Expires</Header>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {history.map((h) => (
                <tr key={h.id} className="hover:bg-slate-50">
                  <Cell>{h.staffName ?? "—"}</Cell>
                  <Cell>{h.staffEmail ?? "—"}</Cell>
                  <Cell className="capitalize">{String(h.status ?? "").toLowerCase()}</Cell>
                  <Cell>{new Date(h.createdAt).toLocaleString()}</Cell>
                  <Cell>{h.usedAt ? new Date(h.usedAt).toLocaleString() : "—"}</Cell>
                  <Cell>{new Date(h.expiresAt).toLocaleString()}</Cell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Header({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">{children}</th>;
}

function Cell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 text-slate-800 ${className}`}>{children}</td>;
}
