"use client";

import { useEffect, useState, useMemo } from "react";

type UploadMeta = {
  staffName?: string;
  staffEmail?: string;
  courseName?: string;
  expiryHint?: string;
  expiresAt: string;
};

export default function UploadPage() {
  const [meta, setMeta] = useState<UploadMeta | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const token = useMemo(() => {
    if (typeof window === "undefined") return "";
    const url = new URL(window.location.href);
    return url.searchParams.get("token") || "";
  }, []);

  useEffect(() => {
    if (!token) return;
    fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5002"}/api/uploads/${encodeURIComponent(token)}`, {
      credentials: "include"
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Invalid or expired link");
        return res.json();
      })
      .then(setMeta)
      .catch((err) => {
        setError(err.message ?? "Invalid link");
      });
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!files.length || !token) return;
    setStatus("loading");
    setError(null);
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5002"}/api/uploads/${encodeURIComponent(token)}/file`,
        {
          method: "POST",
          body: form
        }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Upload failed");
      }
      setStatus("success");
    } catch (err: any) {
      setStatus("error");
      setError(err.message ?? "Upload failed");
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          {error}
        </div>
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-700">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Submit your certificate</h1>
        <p className="mt-1 text-sm text-slate-600">Upload a PDF or image. This link expires at {new Date(meta.expiresAt).toLocaleString()}.</p>
        <div className="mt-4 space-y-1 text-sm text-slate-600">
          {meta.staffName && (
            <p>
              Staff: <span className="font-medium text-slate-900">{meta.staffName}</span>
            </p>
          )}
          {meta.courseName && (
            <p>
              Course: <span className="font-medium text-slate-900">{meta.courseName}</span>
            </p>
          )}
        </div>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <div>
            <label className="block text-sm font-medium text-slate-700">File(s)</label>
            <input
              required
              type="file"
              multiple
              accept=".pdf,image/*"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              className="mt-1 block w-full text-sm text-slate-700"
            />
          </div>
          <button
            type="submit"
            disabled={status === "loading" || !files.length}
            className="w-full rounded-md bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
          >
            {status === "loading" ? "Uploading..." : "Submit"}
          </button>
          {status === "success" && <p className="text-sm text-green-600">Uploaded! You can close this page.</p>}
          {status === "error" && <p className="text-sm text-rose-600">{error}</p>}
        </form>
      </div>
    </div>
  );
}
