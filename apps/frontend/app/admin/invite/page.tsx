"use client";

import { useState } from "react";

export default function InvitePage() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("admin");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setError("");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5002"}/api/auth/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, role })
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to send invite");
      }
      setStatus("sent");
    } catch (err: any) {
      setStatus("error");
      setError(err.message ?? "Failed to send invite");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Invite an admin</h1>
        <p className="mt-2 text-sm text-slate-600">Send a magic-link invite to a teammate.</p>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <div>
            <label className="block text-sm font-medium text-slate-700">Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="teammate@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="admin">Admin</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full rounded-md bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
          >
            {status === "loading" ? "Sending..." : "Send invite"}
          </button>
        </form>
        {status === "sent" && <p className="mt-4 text-sm text-green-600">Invite sent!</p>}
        {status === "error" && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
