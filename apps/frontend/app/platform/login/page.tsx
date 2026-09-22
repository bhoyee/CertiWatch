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
        {status === "error" && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>

      {/* Sent confirmation - a centered modal instead of a small inline line, so it's obvious
          nothing failed and an email (not an in-app redirect) is what happens next. */}
      {status === "sent" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setStatus("idle")}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="platform-magic-link-sent-title"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-9 w-9">
                <rect x="3" y="5.5" width="18" height="13" rx="2" />
                <path d="m4 7 8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <h3 id="platform-magic-link-sent-title" className="mt-5 text-2xl font-semibold text-slate-900">
              Check your inbox
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              We sent a platform sign-in link to <strong>{email}</strong>. Open that email and click the link — that
              logs you in, no password needed.
            </p>
            <p className="mt-3 rounded-md bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-600">
              Don&apos;t see it? Check your spam or junk folder — it can take a minute to arrive.
            </p>
            <button
              onClick={() => setStatus("idle")}
              className="mt-6 w-full rounded-md bg-slate-900 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
