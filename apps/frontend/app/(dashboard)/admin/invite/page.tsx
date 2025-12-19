"use client";

import { useEffect, useState } from "react";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
};

export default function InvitePage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("admin");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [tableError, setTableError] = useState("");
  const [tableLoading, setTableLoading] = useState(false);

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5002";

  const loadUsers = async () => {
    setTableLoading(true);
    setTableError("");
    try {
      const res = await fetch(`${apiBase}/api/users`, { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as UserRow[];
      setUsers(data);
    } catch (err: any) {
      setTableError(err.message ?? "Failed to load invites");
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setError("");
    try {
      const res = await fetch(`${apiBase}/api/auth/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, name, role })
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to send invite");
      }
      setStatus("sent");
      setEmail("");
      setName("");
      loadUsers();
    } catch (err: any) {
      setStatus("error");
      setError(err.message ?? "Failed to send invite");
    }
  };

  const updateUser = async (user: UserRow) => {
    try {
      const res = await fetch(`${apiBase}/api/users/${user.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name: user.name, role: user.role })
      });
      if (!res.ok) throw new Error(await res.text());
      loadUsers();
    } catch (err: any) {
      setTableError(err.message ?? "Failed to update user");
    }
  };

  const deleteUser = async (id: string) => {
    if (!confirm("Remove this user from the workspace?")) return;
    try {
      const res = await fetch(`${apiBase}/api/users/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err: any) {
      setTableError(err.message ?? "Failed to delete user");
    }
  };

  return (
    <div className="cw-card space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Invite teammates</h1>
        <p className="text-sm text-slate-600">Send a magic-link invite to a teammate and manage existing invites.</p>
      </div>

      {status === "sent" && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Invite sent!
        </div>
      )}
      {status === "error" && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      )}

      <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
        <div>
          <label className="block text-sm font-medium text-slate-700">Full name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            placeholder="Ada Lovelace"
          />
        </div>
        <div className="md:col-span-1">
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
        <div className="md:col-span-2 flex items-center gap-2">
          <button
            type="submit"
            disabled={status === "loading"}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
          >
            {status === "loading" ? "Sending..." : "Send invite"}
          </button>
        </div>
      </form>

      <div className="pt-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-slate-800">People & invites</h2>
          <button
            type="button"
            onClick={loadUsers}
            className="text-xs font-semibold text-blue-600 hover:text-blue-500"
            disabled={tableLoading}
          >
            {tableLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        {tableError && <div className="mb-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{tableError}</div>}
        <div className="overflow-auto rounded-md border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-center text-slate-500">
                    No invites yet.
                  </td>
                </tr>
              )}
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-3 py-2">
                    <input
                      value={u.name ?? ""}
                      onChange={(e) => setUsers((prev) => prev.map((row) => (row.id === u.id ? { ...row, name: e.target.value } : row)))}
                      className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-700">{u.email}</td>
                  <td className="px-3 py-2">
                    <select
                      value={u.role}
                      onChange={(e) => setUsers((prev) => prev.map((row) => (row.id === u.id ? { ...row, role: e.target.value } : row)))}
                      className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="admin">Admin</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-right space-x-2">
                    <button
                      onClick={() => updateUser(u)}
                      className="rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => deleteUser(u.id)}
                      className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
