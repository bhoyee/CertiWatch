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
  staffEmail: string;
  expiryDate: string;
};

type BulkResult = { fileName: string; status: string; message?: string | null };

export default function UploadsPage() {
  const [history, setHistory] = useState<UploadHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>({ staffEmail: "", expiryDate: "" });
  const [lastLink, setLastLink] = useState<CreateResponse | null>(null);
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkResults, setBulkResults] = useState<BulkResult[]>([]);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkStatus, setBulkStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [dragActive, setDragActive] = useState(false);

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

  const onBulkFilesSelected = (incoming: FileList | File[]) => {
    const next = Array.from(incoming);
    setBulkFiles(next);
    setBulkResults([]);
    setBulkError(null);
    setBulkStatus("idle");
  };

  const submitBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkFiles.length) return;
    setBulkStatus("uploading");
    setBulkError(null);
    setBulkResults([]);

    const formData = new FormData();
    bulkFiles.forEach((file) => formData.append("files", file));

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5002"}/api/uploads/bulk`,
        {
        method: "POST",
        body: formData
        }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Bulk upload failed (${res.status})`);
      }
      const data = (await res.json()) as { uploaded?: BulkResult[] };
      setBulkResults(data.uploaded ?? []);
      setBulkStatus("done");
    } catch (err: any) {
      setBulkStatus("error");
      setBulkError(err.message ?? "Bulk upload failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Bulk upload</h1>
            <p className="text-sm text-slate-600">
              Drop multiple certificates to queue them immediately. Duplicates by file hash are skipped automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setBulkFiles([]);
              setBulkResults([]);
              setBulkError(null);
              setBulkStatus("idle");
            }}
            className="text-sm font-semibold text-blue-600 hover:text-blue-500"
          >
            Reset
          </button>
        </div>

        <form className="mt-4 space-y-4" onSubmit={submitBulk}>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragActive(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              if (e.dataTransfer?.files?.length) {
                onBulkFilesSelected(e.dataTransfer.files);
              }
            }}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed px-4 py-10 text-center text-sm transition ${
              dragActive ? "border-blue-400 bg-blue-50/60" : "border-slate-300 hover:border-slate-400"
            }`}
          >
            <input
              id="bulk-files"
              type="file"
              multiple
              accept=".pdf,image/*"
              className="hidden"
              onChange={(e) => e.target.files && onBulkFilesSelected(e.target.files)}
            />
            <label htmlFor="bulk-files" className="flex cursor-pointer flex-col items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Drag & drop or click to select
              </span>
              <span className="text-slate-700">PDF or images, multiple at once</span>
              <span className="text-xs text-slate-500">Files are queued immediately; review will handle unknown/duplicates.</span>
            </label>
          </div>

          {bulkFiles.length > 0 && (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{bulkFiles.length} file(s) selected</span>
                <button
                  type="button"
                  onClick={() => setBulkFiles([])}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Clear selection
                </button>
              </div>
              <ul className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                {bulkFiles.map((f) => (
                  <li key={f.name} className="flex items-center justify-between text-xs text-slate-700">
                    <span className="truncate">{f.name}</span>
                    <span className="text-slate-500">{(f.size / 1024 / 1024).toFixed(2)} MB</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <button
              type="submit"
              disabled={bulkStatus === "uploading" || bulkFiles.length === 0}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
            >
              {bulkStatus === "uploading" ? "Queuing..." : "Queue files"}
            </button>
            {bulkStatus === "done" && bulkResults.length > 0 && (
              <span className="text-sm text-green-700">Queued! See per-file results below.</span>
            )}
            {bulkStatus === "error" && bulkError && <span className="text-sm text-rose-700">{bulkError}</span>}
          </div>
        </form>

        {bulkResults.length > 0 && (
          <div className="mt-4 rounded-md border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <Header>File</Header>
                  <Header>Status</Header>
                  <Header>Note</Header>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {bulkResults.map((res, idx) => (
                  <tr key={`${res.fileName}-${idx}`} className="hover:bg-slate-50">
                    <Cell>{res.fileName}</Cell>
                    <Cell className="capitalize">{res.status}</Cell>
                    <Cell className="text-slate-600">{res.message ?? ""}</Cell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Create upload link</h1>
        <p className="text-sm text-slate-600">Generate a one-time link for staff to submit a certificate. Expiry is optional.</p>
        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={submit}>
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
                  <Cell>{h.staffName ?? "?"}</Cell>
                  <Cell>{h.staffEmail ?? "?"}</Cell>
                  <Cell className="capitalize">{String(h.status ?? "").toLowerCase()}</Cell>
                  <Cell>{new Date(h.createdAt).toLocaleString()}</Cell>
                  <Cell>{h.usedAt ? new Date(h.usedAt).toLocaleString() : "?"}</Cell>
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
