"use client";

import { useMemo, useState } from "react";

export default function PlatformLoginPage() {
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5002", []);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setError("");
    try {
      const res = await fetch(`${apiBase}/api/platform/auth/magic-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      if (!res.ok) {
        const body = await res.text();
        try {
          const parsed = JSON.parse(body);
          throw new Error(parsed.error || "Failed to send magic link");
        } catch {
          throw new Error(body || "Failed to send magic link");
        }
      }
      setStatus("sent");
    } catch (err: any) {
      setStatus("error");
      setError(err?.message ?? "Failed to send magic link");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Platform login</h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter the superadmin email to receive a one-time magic link for the platform console.
        </p>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <div>
            <label className="block text-sm font-medium text-slate-700">Superadmin email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="you@example.com"
            />
          </div>
          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full rounded-md bg-slate-900 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {status === "loading" ? "Sending..." : "Send magic link"}
          </button>
        </form>
        {status === "sent" && (
          <p className="mt-4 text-sm text-green-600">Sent! Check your inbox for the platform link.</p>
        )}
        {status === "error" && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
