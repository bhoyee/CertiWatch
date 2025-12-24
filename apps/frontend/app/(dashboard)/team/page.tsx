"use client";

import { useEffect, useState } from "react";
import { deleteJson, fetchJson, patchJson, postJson } from "../../../lib/api";
import { useRole } from "../RoleContext";

type ManagerDto = {
  id: string;
  email: string;
  name?: string | null;
  createdAt: string;
  viewerCount: number;
  isDisabled?: boolean;
};

type ViewerDto = {
  id: string;
  email: string;
  name?: string | null;
  createdAt: string;
  isDisabled?: boolean;
};

export default function TeamPage() {
  const { role } = useRole();
  const isAdmin = role?.toLowerCase() === "admin" || role?.toLowerCase() === "superadmin";
  const [managers, setManagers] = useState<ManagerDto[]>([]);
  const [viewers, setViewers] = useState<ViewerDto[]>([]);
  const [selectedManager, setSelectedManager] = useState<ManagerDto | null>(null);
  const [loadingManagers, setLoadingManagers] = useState(false);
  const [loadingViewers, setLoadingViewers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [managerForm, setManagerForm] = useState({ name: "", email: "" });
  const [viewerForm, setViewerForm] = useState({ name: "", email: "" });
  const [managerSearch, setManagerSearch] = useState("");
  const [viewerSearch, setViewerSearch] = useState("");
  const [managerPage, setManagerPage] = useState(1);
  const [viewerPage, setViewerPage] = useState(1);
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [showViewerModal, setShowViewerModal] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const pageSize = 10;

  const filteredManagers = managers.filter((m) => {
    const term = managerSearch.toLowerCase();
    return !term || (m.email?.toLowerCase().includes(term) || m.name?.toLowerCase().includes(term));
  });
  const filteredViewers = viewers.filter((v) => {
    const term = viewerSearch.toLowerCase();
    return !term || (v.email?.toLowerCase().includes(term) || v.name?.toLowerCase().includes(term));
  });
  const pagedManagers = filteredManagers.slice((managerPage - 1) * pageSize, managerPage * pageSize);
  const pagedViewers = filteredViewers.slice((viewerPage - 1) * pageSize, viewerPage * pageSize);

  useEffect(() => {
    if (!isAdmin) return;
    setLoadingManagers(true);
    fetchJson<ManagerDto[]>("/api/admin/team/managers")
      .then((res) => {
        setManagers(res);
        setError(null);
        if (res.length > 0) {
          setSelectedManager(res[0]);
        }
      })
      .catch((err) => setError(err?.message ?? "Failed to load managers"))
      .finally(() => setLoadingManagers(false));
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    if (!selectedManager) {
      setViewers([]);
      return;
    }
    setLoadingViewers(true);
    fetchJson<ViewerDto[]>(`/api/admin/team/managers/${selectedManager.id}/viewers`)
      .then((res) => {
        setViewers(res);
        setViewerPage(1);
      })
      .catch((err) => setError(err?.message ?? "Failed to load viewers"))
      .finally(() => setLoadingViewers(false));
  }, [selectedManager, isAdmin]);

   const refreshManagers = () => {
     if (!isAdmin) return;
     setLoadingManagers(true);
     fetchJson<ManagerDto[]>("/api/admin/team/managers")
       .then((res) => {
         setManagers(res);
         if (selectedManager) {
           const refreshed = res.find((m) => m.id === selectedManager.id) ?? res[0] ?? null;
           setSelectedManager(refreshed ?? null);
         } else if (res.length > 0) {
           setSelectedManager(res[0]);
         }
         setError(null);
       })
       .catch((err) => setError(err?.message ?? "Failed to refresh managers"))
       .finally(() => setLoadingManagers(false));
   };

   const refreshViewers = () => {
     if (!selectedManager) return;
     setLoadingViewers(true);
     fetchJson<ViewerDto[]>(`/api/admin/team/managers/${selectedManager.id}/viewers`)
       .then((res) => setViewers(res))
       .catch((err) => setError(err?.message ?? "Failed to refresh viewers"))
       .finally(() => setLoadingViewers(false));
   };

  const handleAddManager = async () => {
     if (!managerForm.email) {
       setError("Email is required for a manager");
       return;
     }
     setSaving(true);
     try {
       await postJson("/api/admin/team/managers", managerForm);
      setManagerForm({ name: "", email: "" });
      setShowManagerModal(false);
      refreshManagers();
     } catch (err: any) {
       setError(err?.message ?? "Failed to add manager");
     } finally {
       setSaving(false);
     }
   };

  const handleAddViewer = async () => {
     if (!selectedManager) {
       setError("Select a manager first");
       return;
     }
     if (!viewerForm.email) {
       setError("Email is required for a viewer");
       return;
     }
     setSaving(true);
     try {
       await postJson(`/api/admin/team/managers/${selectedManager.id}/viewers`, viewerForm);
      setViewerForm({ name: "", email: "" });
      setShowViewerModal(false);
      refreshManagers();
      refreshViewers();
     } catch (err: any) {
       setError(err?.message ?? "Failed to add viewer");
     } finally {
       setSaving(false);
     }
   };

   const handleDeleteUser = async (id: string) => {
     if (!window.confirm("Delete this user? This cannot be undone.")) return;
     setSaving(true);
     try {
       await deleteJson(`/api/admin/team/users/${id}`);
       refreshManagers();
       refreshViewers();
     } catch (err: any) {
       setError(err?.message ?? "Failed to delete user");
     } finally {
       setSaving(false);
     }
   };

   const handleReassignViewer = async (viewerId: string, managerId: string) => {
     setSaving(true);
     try {
       await patchJson(`/api/admin/team/viewers/${viewerId}/reassign`, { managerId });
       refreshManagers();
       refreshViewers();
     } catch (err: any) {
       setError(err?.message ?? "Failed to reassign viewer");
     } finally {
       setSaving(false);
     }
   };

  const handleRename = async (userId: string, currentName?: string | null) => {
    setEditUserId(userId);
    setEditName(currentName ?? "");
  };

  const toggleDisable = async (userId: string, isDisabled: boolean) => {
    setSaving(true);
    try {
      await patchJson(`/api/admin/team/users/${userId}`, { isDisabled: !isDisabled });
      refreshManagers();
      refreshViewers();
    } catch (err: any) {
      setError(err?.message ?? "Failed to update status");
    } finally {
      setSaving(false);
    }
  };

  const submitRename = async () => {
    if (!editUserId) return;
    setSaving(true);
    try {
      await patchJson(`/api/admin/team/users/${editUserId}`, { name: editName });
      setEditUserId(null);
      setEditName("");
      refreshManagers();
      refreshViewers();
    } catch (err: any) {
      setError(err?.message ?? "Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="cw-card space-y-2 p-6">
        <h1 className="text-lg font-semibold text-slate-900">Team management</h1>
        <p className="text-sm text-slate-600">Admins only.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-lg font-semibold text-slate-900">Team management</h1>
        <p className="text-sm text-slate-600">View managers and their viewers.</p>
        {error && <p className="text-xs text-rose-600">{error}</p>}
      </div>
      {(showManagerModal || showViewerModal || editUserId) && (
        <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm" onClick={() => { setShowManagerModal(false); setShowViewerModal(false); setEditUserId(null); }} />
      )}
      {showManagerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg space-y-4 rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Invite manager</h3>
              <button onClick={() => setShowManagerModal(false)} className="text-slate-500 hover:text-slate-700">
                ✕
              </button>
            </div>
            <input
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              placeholder="Name (optional)"
              value={managerForm.name}
              onChange={(e) => setManagerForm((p) => ({ ...p, name: e.target.value }))}
            />
            <input
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              placeholder="Email"
              value={managerForm.email}
              onChange={(e) => setManagerForm((p) => ({ ...p, email: e.target.value }))}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowManagerModal(false)}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddManager}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                disabled={saving}
              >
                {saving ? "Saving..." : "Invite manager"}
              </button>
            </div>
          </div>
        </div>
      )}
      {showViewerModal && selectedManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg space-y-4 rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                Invite viewer for {selectedManager.name ?? selectedManager.email}
              </h3>
              <button onClick={() => setShowViewerModal(false)} className="text-slate-500 hover:text-slate-700">
                ✕
              </button>
            </div>
            <input
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              placeholder="Name (optional)"
              value={viewerForm.name}
              onChange={(e) => setViewerForm((p) => ({ ...p, name: e.target.value }))}
            />
            <input
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              placeholder="Email"
              value={viewerForm.email}
              onChange={(e) => setViewerForm((p) => ({ ...p, email: e.target.value }))}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowViewerModal(false)}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddViewer}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                disabled={saving}
              >
                {saving ? "Saving..." : "Invite viewer"}
              </button>
            </div>
          </div>
        </div>
      )}
      {editUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Edit name</h3>
              <button onClick={() => setEditUserId(null)} className="text-slate-500 hover:text-slate-700">
                ✕
              </button>
            </div>
            <input
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              placeholder="Name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditUserId(null)}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={submitRename}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Managers</p>
              <h2 className="text-base font-semibold text-slate-900">{managers.length} managers</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={refreshManagers}
                className="rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                disabled={loadingManagers}
              >
                {loadingManagers ? "Refreshing..." : "Refresh"}
              </button>
              <button
                onClick={() => setShowManagerModal(true)}
                className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Invite manager
              </button>
            </div>
          </div>

          {loadingManagers && managers.length === 0 ? (
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-sm text-slate-600">Loading managers...</div>
          ) : managers.length === 0 ? (
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700">No managers found.</div>
          ) : (
            <div className="overflow-hidden rounded-md border border-slate-100">
              <div className="flex items-center justify-between px-3 py-2">
                <input
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Search managers"
                  value={managerSearch}
                  onChange={(e) => {
                    setManagerSearch(e.target.value);
                    setManagerPage(1);
                  }}
                />
              </div>
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Name / Email</th>
                    <th className="px-3 py-2 text-left">Viewers</th>
                    <th className="px-3 py-2 text-left">Created</th>
                    <th className="px-3 py-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedManagers.map((m) => {
                    const isActive = selectedManager?.id === m.id;
                    return (
                      <tr
                        key={m.id}
                        className={`border-t border-slate-100 text-slate-700 ${isActive ? "bg-slate-100" : ""} ${
                          m.isDisabled ? "opacity-60" : ""
                        }`}
                      >
                        <td className="px-3 py-2 align-top">
                          <div className="font-semibold text-slate-900">{m.name ?? m.email}</div>
                          <div className="text-xs text-slate-500">{m.email}</div>
                          {m.isDisabled && <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 text-[11px] font-semibold text-amber-800">Disabled</span>}
                        </td>
                        <td className="px-3 py-2 align-top">{m.viewerCount}</td>
                        <td className="px-3 py-2 align-top text-xs text-slate-500">{new Date(m.createdAt).toLocaleDateString()}</td>
                        <td className="px-3 py-2 align-top text-center">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => setSelectedManager(m)}
                              className="rounded-md bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800"
                            >
                              View
                            </button>
                            <button
                              onClick={() => handleRename(m.id, m.name ?? m.email)}
                              className="rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              disabled={saving}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteUser(m.id)}
                              className="rounded-md border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                              disabled={saving}
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => toggleDisable(m.id, m.isDisabled ?? false)}
                              className="rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              disabled={saving}
                            >
                              {m.isDisabled ? "Activate" : "Deactivate"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredManagers.length > 0 && (
                <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-xs text-slate-600">
                  <span>
                    Showing{" "}
                    {Math.min((managerPage - 1) * pageSize + 1, filteredManagers.length)}-
                    {Math.min(managerPage * pageSize, filteredManagers.length)} of {filteredManagers.length} • Page {managerPage} /
                    {Math.max(1, Math.ceil(filteredManagers.length / pageSize))}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setManagerPage((p) => Math.max(1, p - 1))}
                      disabled={managerPage === 1}
                      className="rounded-md border border-slate-200 px-2 py-1 disabled:opacity-50"
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => setManagerPage((p) => (p * pageSize < filteredManagers.length ? p + 1 : p))}
                      disabled={managerPage * pageSize >= filteredManagers.length}
                      className="rounded-md border border-slate-200 px-2 py-1 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 space-y-2 rounded-md border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Add manager</p>
            <div className="grid gap-2 md:grid-cols-2">
              <input
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                placeholder="Name (optional)"
                value={managerForm.name}
                onChange={(e) => setManagerForm((p) => ({ ...p, name: e.target.value }))}
              />
              <input
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                placeholder="Email"
                value={managerForm.email}
                onChange={(e) => setManagerForm((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
            <button
              onClick={handleAddManager}
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              disabled={saving}
            >
              {saving ? "Saving..." : "Invite manager"}
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Viewers</p>
              <h2 className="text-base font-semibold text-slate-900">
                {selectedManager ? selectedManager.name ?? selectedManager.email : "Select a manager"}
              </h2>
            </div>
            {selectedManager && (
              <button
                onClick={() => setShowViewerModal(true)}
                className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                disabled={saving}
              >
                {saving ? "Saving..." : "Add viewer"}
              </button>
            )}
          </div>

          {!selectedManager ? (
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700">Select a manager to see viewers.</div>
          ) : loadingViewers ? (
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-sm text-slate-600">Loading viewers...</div>
          ) : viewers.length === 0 ? (
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700">No viewers under this manager.</div>
          ) : (
            <div className="overflow-hidden rounded-md border border-slate-100">
              <div className="flex items-center justify-between px-3 py-2">
                <input
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Search viewers"
                  value={viewerSearch}
                  onChange={(e) => {
                    setViewerSearch(e.target.value);
                    setViewerPage(1);
                  }}
                />
              </div>
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Name / Email</th>
                    <th className="px-3 py-2 text-left">Created</th>
                    <th className="px-3 py-2 text-center">Reassign</th>
                    <th className="px-3 py-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedViewers.map((v) => (
                    <tr key={v.id} className="border-t border-slate-100 text-slate-700">
                      <td className="px-3 py-2 align-top">
                        <div className="font-semibold text-slate-900">{v.name ?? v.email}</div>
                        <div className="text-xs text-slate-500">{v.email}</div>
                        {v.isDisabled && <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 text-[11px] font-semibold text-amber-800">Disabled</span>}
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-slate-500">{new Date(v.createdAt).toLocaleDateString()}</td>
                      <td className="px-3 py-2 align-top text-center">
                        <select
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                          value={selectedManager?.id ?? ""}
                          onChange={(e) => handleReassignViewer(v.id, e.target.value)}
                        >
                          {managers.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name ?? m.email}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 align-top text-center">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleRename(v.id, v.name ?? v.email)}
                            className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            disabled={saving}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteUser(v.id)}
                            className="rounded-md border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                            disabled={saving}
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => toggleDisable(v.id, v.isDisabled ?? false)}
                            className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            disabled={saving}
                          >
                            {v.isDisabled ? "Activate" : "Deactivate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredViewers.length > 0 && (
                <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-xs text-slate-600">
                  <span>
                    Showing{" "}
                    {Math.min((viewerPage - 1) * pageSize + 1, filteredViewers.length)}-
                    {Math.min(viewerPage * pageSize, filteredViewers.length)} of {filteredViewers.length} • Page {viewerPage} /
                    {Math.max(1, Math.ceil(filteredViewers.length / pageSize))}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setViewerPage((p) => Math.max(1, p - 1))}
                      disabled={viewerPage === 1}
                      className="rounded-md border border-slate-200 px-2 py-1 disabled:opacity-50"
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => setViewerPage((p) => (p * pageSize < filteredViewers.length ? p + 1 : p))}
                      disabled={viewerPage * pageSize >= filteredViewers.length}
                      className="rounded-md border border-slate-200 px-2 py-1 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {selectedManager && (
            <div className="mt-4 space-y-2 rounded-md border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Add viewer for {selectedManager.name ?? selectedManager.email}
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                <input
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Name (optional)"
                  value={viewerForm.name}
                  onChange={(e) => setViewerForm((p) => ({ ...p, name: e.target.value }))}
                />
                <input
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Email"
                  value={viewerForm.email}
                  onChange={(e) => setViewerForm((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddViewer}
                  className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Invite viewer"}
                </button>
                <button
                  onClick={() => setShowViewerModal(true)}
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Open modal
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
