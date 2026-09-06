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
  isDisabled: boolean;
  lastLoginAt?: string | null;
};

const ROLE_STYLES: Record<string, string> = {
  admin: "bg-indigo-100 text-indigo-700",
  manager: "bg-blue-100 text-blue-700",
  viewer: "bg-slate-100 text-slate-600"
};

function RoleBadge({ role }: { role: string }) {
  const color = ROLE_STYLES[role.toLowerCase()] ?? "bg-slate-100 text-slate-600";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${color}`}>{role}</span>;
}

// "Active" only once the invite has actually been used at least once (a real login recorded) -
// otherwise the badge said "Active" for someone who had never even clicked their invite link,
// which reads as if they already have access when really the invite is just sitting unopened.
function StatusBadge({ isDisabled, lastLoginAt }: { isDisabled: boolean; lastLoginAt?: string | null }) {
  if (isDisabled) {
    return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">Disabled</span>;
  }
  if (!lastLoginAt) {
    return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Pending</span>;
  }
  return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Active</span>;
}

export default function InvitePage() {
  const { role: currentRole } = useRole();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("admin");
  const [addToStaff, setAddToStaff] = useState(false);
  const [jobTitle, setJobTitle] = useState("");
  const [startDate, setStartDate] = useState("");
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
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [confirmDeactivateUser, setConfirmDeactivateUser] = useState<UserRow | null>(null);
  const [deactivateConfirmText, setDeactivateConfirmText] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5002";
  const isAdmin = currentRole?.toLowerCase() === "admin" || currentRole?.toLowerCase() === "superadmin";
  const isViewer = currentRole?.toLowerCase() === "viewer";
  const isManager = currentRole?.toLowerCase() === "manager";

  const loadProfile = async () => {
    try {
      const res = await fetch(`${apiBase}/api/profile`, { cache: "no-store", credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setCurrentUserId(data.id ?? null);
      setCurrentEmail(data.email ?? null);
    } catch {
      // ignore profile errors; invite list will simply be empty for managers
    }
  };

  const loadUsers = async () => {
    setTableLoading(true);
    setTableError("");
    try {
      const res = await fetch(`${apiBase}/api/users`, { cache: "no-store", credentials: "include" });
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
          "Content-Type": "application/json",
          ...(currentEmail ? { "X-Admin-Email": currentEmail } : {})
        },
        credentials: "include",
        body: JSON.stringify({
          email,
          name,
          role: inviteRole,
          addToStaff,
          jobTitle: addToStaff && jobTitle ? jobTitle : null,
          startDate: addToStaff && startDate ? startDate : null
        })
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to send invite");
      }
      setStatus("sent");
      setEmail("");
      setName("");
      setAddToStaff(false);
      setJobTitle("");
      setStartDate("");
      loadUsers();
    } catch (err: any) {
      setStatus("error");
      setError(err.message ?? "Failed to send invite");
    }
  };

  const patchUser = async (id: string, body: Record<string, unknown>) => {
    const res = await fetch(`${apiBase}/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(await res.text());
  };

  const updateUser = async (user: UserRow) => {
    setSavingId(user.id);
    try {
      await patchUser(user.id, { name: user.name, role: user.role });
      loadUsers();
    } catch (err: any) {
      setTableError(err.message ?? "Failed to update user");
    } finally {
      setSavingId(null);
    }
  };

  // Re-activating is benign and immediate; deactivating cuts off someone's access, so that
  // direction goes through the type-to-confirm modal below instead of firing on a single click.
  const requestToggleDisabled = (user: UserRow) => {
    if (user.isDisabled) {
      performToggleDisabled(user);
    } else {
      setConfirmDeactivateUser(user);
      setDeactivateConfirmText("");
    }
  };

  const performToggleDisabled = async (user: UserRow) => {
    setSavingId(user.id);
    try {
      await patchUser(user.id, { isDisabled: !user.isDisabled });
      setConfirmDeactivateUser(null);
      setDeactivateConfirmText("");
      loadUsers();
    } catch (err: any) {
      setTableError(err.message ?? "Failed to update status");
    } finally {
      setSavingId(null);
    }
  };

  const reassignManager = async (viewerId: string, managerId: string) => {
    setSavingId(viewerId);
    try {
      await patchUser(viewerId, { managerId });
      loadUsers();
    } catch (err: any) {
      setTableError(err.message ?? "Failed to reassign manager");
    } finally {
      setSavingId(null);
    }
  };

  const deleteUser = async (id: string) => {
    setSavingId(id);
    try {
      const res = await fetch(`${apiBase}/api/users/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      setUsers((prev) => prev.filter((u) => u.id !== id));
      setConfirmDeleteId(null);
      setDeleteConfirmText("");
    } catch (err: any) {
      setTableError(err.message ?? "Failed to delete user");
    } finally {
      setSavingId(null);
    }
  };

  const managers = useMemo(() => users.filter((u) => u.role.toLowerCase() === "manager"), [users]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    const scoped = isManager
      ? users.filter(
          (u) => u.role.toLowerCase() === "viewer" && (!!currentUserId ? u.invitedByUserId === currentUserId : false)
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
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 text-white shadow-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
            <path d="M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="9.5" cy="7.5" r="3.5" />
            <path d="M19 8v4M21 10h-4" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Team & invites</h1>
          <p className="text-sm text-slate-600">Invite teammates, manage their roles, and see who reports to whom.</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Send an invite</h2>
        {status === "sent" && (
          <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Invite sent!
          </div>
        )}
        {status === "error" && (
          <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
        )}
        <form className="mt-3 grid gap-4 md:grid-cols-[1.2fr_1.2fr_1fr_auto] md:items-end" onSubmit={submit}>
          <div>
            <label className="block text-xs font-semibold text-slate-600">Full name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border-2 border-slate-300 px-3 py-2 text-sm shadow-inner transition focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100"
              placeholder="Ada Lovelace"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600">Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border-2 border-slate-300 px-3 py-2 text-sm shadow-inner transition focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100"
              placeholder="teammate@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600">Role</label>
            <select
              value={isManager ? "viewer" : role}
              onChange={(e) => setRole(e.target.value)}
              disabled={isManager}
              className="mt-1 w-full rounded-md border-2 border-slate-300 px-3 py-2 text-sm shadow-inner transition focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-50"
            >
              {roleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={status === "loading"}
            className="rounded-md bg-gradient-to-r from-indigo-500 to-blue-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
          >
            {status === "loading" ? "Sending..." : "Send invite"}
          </button>

          {/* Not automatic: a login account and a tracked-for-compliance staff record are
              different things that don't always overlap (an invited admin may just need system
              access, while a manager who's also a line supervisor may need their own DBS/NVQ
              tracked) - so this is an opt-in per invite, not tied to role. */}
          <div className="md:col-span-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={addToStaff}
                onChange={(e) => setAddToStaff(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Also add {name || "this person"} to the Staff list, for tracking their own certificates
            </label>
            {addToStaff && (
              <div className="mt-2 grid gap-3 rounded-md border border-indigo-100 bg-indigo-50/40 p-3 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600">Job title (optional)</label>
                  <input
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="Care Assistant"
                    className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600">Start date (optional)</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        </form>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Team members</h2>
            <p className="text-xs text-slate-500">{filtered.length} people</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search name, email, role"
              className="rounded-md border-2 border-slate-300 px-3 py-1.5 text-sm shadow-inner transition focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100"
            />
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-md border border-slate-200 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
            >
              {[5, 10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={loadUsers}
              disabled={tableLoading}
              className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
            >
              {tableLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {tableError && (
          <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{tableError}</div>
        )}

        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="cursor-pointer border-r border-slate-200 px-3 py-2" onClick={() => toggleSort("name")}>
                  Name
                </th>
                <th className="cursor-pointer border-r border-slate-200 px-3 py-2" onClick={() => toggleSort("email")}>
                  Email
                </th>
                <th className="cursor-pointer border-r border-slate-200 px-3 py-2" onClick={() => toggleSort("role")}>
                  Role
                </th>
                {isAdmin && <th className="border-r border-slate-200 px-3 py-2">Manager</th>}
                <th className="border-r border-slate-200 px-3 py-2">Status</th>
                <th className="cursor-pointer border-r border-slate-200 px-3 py-2" onClick={() => toggleSort("createdAt")}>
                  Created
                </th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {pageItems.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="px-3 py-6 text-center text-slate-500">
                    No invites yet.
                  </td>
                </tr>
              )}
              {pageItems.map((u) => {
                const isSelf = !!currentEmail && u.email.toLowerCase() === currentEmail.toLowerCase();
                const canEditRole = isAdmin || (isManager && u.role.toLowerCase() === "viewer");
                return (
                  <tr key={u.id} className={u.isDisabled ? "bg-slate-50/60" : ""}>
                    <td className="border-r border-slate-100 px-3 py-2">
                      <input
                        value={u.name ?? ""}
                        onChange={(e) => setUsers((prev) => prev.map((row) => (row.id === u.id ? { ...row, name: e.target.value } : row)))}
                        className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </td>
                    <td className="border-r border-slate-100 px-3 py-2 font-mono text-xs text-slate-700">{u.email}</td>
                    <td className="border-r border-slate-100 px-3 py-2">
                      {canEditRole ? (
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
                      ) : (
                        <RoleBadge role={u.role} />
                      )}
                    </td>
                    {isAdmin && (
                      <td className="border-r border-slate-100 px-3 py-2">
                        {u.role.toLowerCase() === "viewer" ? (
                          <select
                            value={u.invitedByUserId ?? ""}
                            onChange={(e) => reassignManager(u.id, e.target.value)}
                            disabled={savingId === u.id || managers.length === 0}
                            className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none disabled:bg-slate-50"
                          >
                            <option value="" disabled>
                              {managers.length === 0 ? "No managers yet" : "Unassigned"}
                            </option>
                            {managers.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name ?? m.email}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    )}
                    <td className="border-r border-slate-100 px-3 py-2">
                      <StatusBadge isDisabled={u.isDisabled} lastLoginAt={u.lastLoginAt} />
                    </td>
                    <td className="border-r border-slate-100 px-3 py-2 text-slate-600">{new Date(u.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => updateUser(u)}
                          disabled={savingId === u.id}
                          className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
                        >
                          {savingId === u.id ? "..." : "Save"}
                        </button>
                        <button
                          onClick={() => requestToggleDisabled(u)}
                          disabled={savingId === u.id || isSelf}
                          title={isSelf ? "You can't disable your own account" : undefined}
                          className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
                        >
                          {u.isDisabled ? "Activate" : "Deactivate"}
                        </button>
                        <button
                          onClick={() => {
                            setConfirmDeleteId(u.id);
                            setDeleteConfirmText("");
                          }}
                          disabled={isSelf}
                          className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
          <div>
            Showing {filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filtered.length)} of{" "}
            {filtered.length}
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
            <p className="mt-2 text-sm text-slate-600">
              This will permanently revoke access for this user. This cannot be undone.
            </p>
            <label className="mt-3 block text-xs font-semibold text-slate-600">
              Type <span className="font-mono text-rose-600">DELETE</span> to confirm
            </label>
            <input
              autoFocus
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className="mt-1 w-full rounded-md border-2 border-slate-300 px-2 py-1.5 text-sm focus:border-rose-500 focus:outline-none focus:ring-4 focus:ring-rose-100"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-md border border-slate-200 px-3 py-1 text-sm text-slate-700 hover:border-slate-300"
                onClick={() => {
                  setConfirmDeleteId(null);
                  setDeleteConfirmText("");
                }}
              >
                Cancel
              </button>
              <button
                className="rounded-md bg-rose-600 px-3 py-1 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
                onClick={() => deleteUser(confirmDeleteId)}
                disabled={savingId === confirmDeleteId || deleteConfirmText.trim().toUpperCase() !== "DELETE"}
              >
                {savingId === confirmDeleteId ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeactivateUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg">
            <h3 className="text-base font-semibold text-slate-900">
              Deactivate {confirmDeactivateUser.name ?? confirmDeactivateUser.email}?
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              They will immediately lose access to CertiWatch. You can reactivate them again later.
            </p>
            <label className="mt-3 block text-xs font-semibold text-slate-600">
              Type <span className="font-mono text-amber-700">DEACTIVATE</span> to confirm
            </label>
            <input
              autoFocus
              value={deactivateConfirmText}
              onChange={(e) => setDeactivateConfirmText(e.target.value)}
              placeholder="DEACTIVATE"
              className="mt-1 w-full rounded-md border-2 border-slate-300 px-2 py-1.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-4 focus:ring-amber-100"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-md border border-slate-200 px-3 py-1 text-sm text-slate-700 hover:border-slate-300"
                onClick={() => {
                  setConfirmDeactivateUser(null);
                  setDeactivateConfirmText("");
                }}
              >
                Cancel
              </button>
              <button
                className="rounded-md bg-amber-600 px-3 py-1 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
                onClick={() => performToggleDisabled(confirmDeactivateUser)}
                disabled={savingId === confirmDeactivateUser.id || deactivateConfirmText.trim().toUpperCase() !== "DEACTIVATE"}
              >
                {savingId === confirmDeactivateUser.id ? "Deactivating..." : "Deactivate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
