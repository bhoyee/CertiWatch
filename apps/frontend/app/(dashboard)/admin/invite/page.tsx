"use client";

import { useEffect, useMemo, useState } from "react";
import { useRole } from "../../RoleContext";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  invitedByUserId?: string | null;
  createdAt: string;
};

export default function InvitePage() {
  const { role: currentRole } = useRole();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("admin");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [tableError, setTableError] = useState("");
  const [tableLoading, setTableLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof UserRow>("email");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5002";
  const isViewer = currentRole?.toLowerCase() === "viewer";
  const isManager = currentRole?.toLowerCase() === "manager";

  const loadProfile = async () => {
    try {
      const res = await fetch(`${apiBase}/api/profile`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setCurrentUserId(data.id ?? null);
    }
    catch {
      // ignore profile errors; invite list will simply be empty for managers
    }
  };

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
    loadProfile();
    loadUsers();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setError("");
    try {
      const inviteRole = isManager ? "viewer" : role;
      const res = await fetch(`${apiBase}/api/auth/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, name, role: inviteRole })
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
    setSavingId(user.id);
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
    } finally {
      setSavingId(null);
    }
  };

  const deleteUser = async (id: string) => {
    setConfirmDeleteId(null);
    setSavingId(id);
    try {
      const res = await fetch(`${apiBase}/api/users/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err: any) {
      setTableError(err.message ?? "Failed to delete user");
    } finally {
      setSavingId(null);
    }
  };

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    const scoped = isManager
      ? users.filter(
          (u) =>
            u.role.toLowerCase() === "viewer" &&
            (!!currentUserId ? u.invitedByUserId === currentUserId : false)
        )
      : users;
    const base = term
      ? scoped.filter(
          (u) =>
            (u.name ?? "").toLowerCase().includes(term) ||
            u.email.toLowerCase().includes(term) ||
            u.role.toLowerCase().includes(term)
        )
      : scoped;
    const sorted = [...base].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const av = (a[sortKey] ?? "").toString().toLowerCase();
      const bv = (b[sortKey] ?? "").toString().toLowerCase();
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return sorted;
  }, [users, search, sortDir, sortKey, isManager, currentUserId]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleSort = (key: keyof UserRow) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  if (isViewer) {
    return (
      <div className="cw-card space-y-2 p-6">
        <h1 className="text-lg font-semibold text-slate-900">Invite</h1>
        <p className="text-sm text-slate-600">Viewers cannot send invites. Ask an admin to invite new teammates.</p>
      </div>
    );
  }

  const roleOptions = isManager
    ? [{ value: "viewer", label: "Viewer" }]
    : [
        { value: "admin", label: "Admin" },
        { value: "manager", label: "Manager" },
        { value: "viewer", label: "Viewer" }
      ];

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
            value={isManager ? "viewer" : role}
            onChange={(e) => setRole(e.target.value)}
            disabled={isManager}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-50"
          >
            {roleOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
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
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-slate-800">People & invites</h2>
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search name, email, role"
              className="rounded-md border border-slate-200 px-3 py-1 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-600">Rows</label>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-md border border-slate-200 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
            >
              {[5, 10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={loadUsers}
              className="text-xs font-semibold text-blue-600 hover:text-blue-500"
              disabled={tableLoading}
            >
              {tableLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>
        {tableError && <div className="mb-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{tableError}</div>}
        <div className="overflow-auto rounded-md border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-2 cursor-pointer" onClick={() => toggleSort("name")}>
                  Name
                </th>
                <th className="px-3 py-2 cursor-pointer" onClick={() => toggleSort("email")}>
                  Email
                </th>
                <th className="px-3 py-2 cursor-pointer" onClick={() => toggleSort("role")}>
                  Role
                </th>
                <th className="px-3 py-2 cursor-pointer" onClick={() => toggleSort("createdAt")}>
                  Created
                </th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {pageItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-center text-slate-500">
                    No invites yet.
                  </td>
                </tr>
              )}
              {pageItems.map((u) => (
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
                      value={isManager ? "viewer" : u.role}
                      onChange={(e) => setUsers((prev) => prev.map((row) => (row.id === u.id ? { ...row, role: e.target.value } : row)))}
                      disabled={isManager}
                      className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-50"
                    >
                      {roleOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2 space-x-2 text-right">
                    <button
                      onClick={() => updateUser(u)}
                      disabled={savingId === u.id}
                      className="rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 disabled:opacity-50"
                    >
                      {savingId === u.id ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(u.id)}
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
        <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
          <div>
            Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-md border border-slate-200 px-2 py-1 hover:border-slate-300 disabled:opacity-50"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Prev
            </button>
            <span className="font-semibold text-slate-800">
              Page {currentPage} / {totalPages}
            </span>
            <button
              className="rounded-md border border-slate-200 px-2 py-1 hover:border-slate-300 disabled:opacity-50"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg">
            <h3 className="text-base font-semibold text-slate-900">Remove user?</h3>
            <p className="mt-2 text-sm text-slate-600">This will revoke access for this user. Continue?</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-md border border-slate-200 px-3 py-1 text-sm text-slate-700 hover:border-slate-300"
                onClick={() => setConfirmDeleteId(null)}
              >
                Cancel
              </button>
              <button
                className="rounded-md bg-rose-600 px-3 py-1 text-sm font-semibold text-white hover:bg-rose-500"
                onClick={() => deleteUser(confirmDeleteId)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
