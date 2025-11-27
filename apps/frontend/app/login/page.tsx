"use client";

import { useEffect, useMemo, useState } from "react";
import Cookies from "js-cookie";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [fallbackEmail, setFallbackEmail] = useState("");
  const [rememberDevice, setRememberDevice] = useState(true);
  const [deviceId, setDeviceId] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5002", []);

  useEffect(() => {
    const existing = Cookies.get("cw_device");
    if (existing) {
      setDeviceId(existing);
      return;
    }
    const generated = crypto.randomUUID();
    setDeviceId(generated);
    Cookies.set("cw_device", generated, { expires: 365, sameSite: "lax" });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setError("");
    try {
      const res = await fetch(`${apiBase}/api/auth/magic-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          fallbackEmail: fallbackEmail || null,
          rememberDevice,
          deviceId: deviceId || null
        })
      });
      if (!res.ok) {
        const text = await res.text();
        try {
          const parsed = JSON.parse(text);
          throw new Error(parsed.friendlyError || parsed.error || "Failed to send magic link");
        } catch {
          throw new Error(text || "Failed to send magic link");
        }
      }
      setStatus("sent");
    } catch (err: any) {
      setStatus("error");
      setError(err.message ?? "Failed to send magic link");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Login with magic link</h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter your email and we’ll send you a sign-in link. You can add a backup email and stay signed in on this
          device.
        </p>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <div>
            <label className="block text-sm font-medium text-slate-700">Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Fallback email (optional)</label>
            <input
              type="email"
              value={fallbackEmail}
              onChange={(e) => setFallbackEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="admins@company.com"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={(e) => setRememberDevice(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Stay signed in on this device
          </label>
          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full rounded-md bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
          >
            {status === "loading" ? "Sending..." : "Send magic link"}
          </button>
        </form>
        {status === "sent" && (
          <p className="mt-4 text-sm text-green-600">
            Sent! Check your inbox{fallbackEmail ? ` (and ${fallbackEmail})` : ""}.
          </p>
        )}
        {status === "error" && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
