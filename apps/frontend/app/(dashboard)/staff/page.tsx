"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchJson, postJson } from "../../../lib/api";

type StaffMemberDto = {
  id: string;
  name: string;
  jobTitle: string | null;
  startDate: string | null;
  isActive: boolean;
  createdAt: string;
};

type StaffForm = {
  name: string;
  jobTitle: string;
  startDate: string;
};

const emptyForm: StaffForm = { name: "", jobTitle: "", startDate: "" };

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMemberDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [form, setForm] = useState<StaffForm>(emptyForm);
  const [editing, setEditing] = useState<StaffMemberDto | null>(null);
  const [editForm, setEditForm] = useState<StaffForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<StaffMemberDto | null>(null);

  const load = () => {
    fetchJson<StaffMemberDto[]>("/api/staff")
      .then(setStaff)
      .catch((err) => setError(err.message ?? "Failed to load staff"));
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!staff) return [];
    const term = search.trim().toLowerCase();
    return staff.filter((s) => {
      if (!showInactive && !s.isActive) return false;
      if (!term) return true;
      return s.name.toLowerCase().includes(term) || (s.jobTitle ?? "").toLowerCase().includes(term);
    });
  }, [staff, search, showInactive]);

  if (error) return <ErrorCard message={error} />;
  if (!staff) return <LoadingCard />;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Staff</h1>
            <p className="text-sm text-slate-600">
              Everyone you're tracking compliance for — including anyone who hasn't had a certificate uploaded yet.
            </p>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, role..."
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none md:w-64"
            />
            <label className="flex items-center gap-2 whitespace-nowrap text-sm text-slate-700">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Show inactive
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <Header>Name</Header>
                <Header>Job title</Header>
                <Header>Start date</Header>
                <Header>Status</Header>
                <Header>Actions</Header>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <Cell>{s.name}</Cell>
                  <Cell>{s.jobTitle ?? "—"}</Cell>
                  <Cell>{formatDate(s.startDate)}</Cell>
                  <Cell>
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                        s.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {s.isActive ? "Active" : "Inactive"}
                    </span>
                  </Cell>
                  <Cell>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          setEditing(s);
                          setEditForm({
                            name: s.name,
                            jobTitle: s.jobTitle ?? "",
                            startDate: s.startDate ?? ""
                          });
                        }}
                        className="text-xs font-semibold text-blue-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await patchStaff(s.id, { isActive: !s.isActive });
                            load();
                          } catch (err: any) {
                            setError(err?.message ?? "Failed to update staff member");
                          }
                        }}
                        className="text-xs font-semibold text-slate-600 hover:underline"
                      >
                        {s.isActive ? "Deactivate" : "Reactivate"}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(s)}
                        className="text-xs font-semibold text-rose-600 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </Cell>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-sm text-slate-500">
                    {staff.length === 0 ? "No staff added yet — add your first one below." : "No staff match your filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-md font-semibold text-slate-900">Add a staff member</h2>
        <p className="text-sm text-slate-600">Just a name to start — everything else is optional.</p>
        <form
          className="mt-4 grid gap-4 md:grid-cols-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setCreating(true);
            setError(null);
            try {
              await postJson("/api/staff", {
                name: form.name.trim(),
                jobTitle: form.jobTitle.trim() || null,
                startDate: form.startDate || null
              });
              load();
              setForm(emptyForm);
            } catch (err: any) {
              setError(err?.message ?? "Failed to add staff member");
            } finally {
              setCreating(false);
            }
          }}
        >
          <Field label="Name" required value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Jane Doe" />
          <Field label="Job title" value={form.jobTitle} onChange={(v) => setForm({ ...form, jobTitle: v })} placeholder="Carer" />
          <Field label="Start date" type="date" value={form.startDate} onChange={(v) => setForm({ ...form, startDate: v })} />
          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={creating || !form.name.trim()}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
            >
              {creating ? "Adding..." : "Add staff member"}
            </button>
            {error && <span className="ml-3 text-sm text-rose-700">{error}</span>}
          </div>
        </form>
      </div>

      {editing && editForm && (
        <Modal onClose={() => (!savingEdit ? setEditing(null) : null)} title="Edit staff member">
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!editing) return;
              setSavingEdit(true);
              setError(null);
              try {
                await patchStaff(editing.id, {
                  name: editForm.name.trim(),
                  jobTitle: editForm.jobTitle.trim() || null,
                  startDate: editForm.startDate || null
                });
                load();
                setEditing(null);
                setEditForm(null);
              } catch (err: any) {
                setError(err?.message ?? "Failed to update staff member");
              } finally {
                setSavingEdit(false);
              }
            }}
          >
            <Field label="Name" required value={editForm.name} onChange={(v) => setEditForm({ ...editForm, name: v })} />
            <Field label="Job title" value={editForm.jobTitle} onChange={(v) => setEditForm({ ...editForm, jobTitle: v })} />
            <Field label="Start date" type="date" value={editForm.startDate} onChange={(v) => setEditForm({ ...editForm, startDate: v })} />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={savingEdit}
                onClick={() => {
                  if (!savingEdit) {
                    setEditing(null);
                    setEditForm(null);
                  }
                }}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
              >
                {savingEdit ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(null)} title="Delete staff member?">
          <div className="space-y-3">
            <p className="text-sm text-slate-700">
              This will permanently delete “{confirmDelete.name}” from the staff directory. This cannot be undone — if
              they've just left, use Deactivate instead to keep their history.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!confirmDelete) return;
                  try {
                    const res = await fetch(`${apiBase()}/api/staff/${confirmDelete.id}`, {
                      method: "DELETE",
                      credentials: "include"
                    });
                    if (!res.ok) throw new Error("Failed to delete staff member");
                    load();
                    setConfirmDelete(null);
                  } catch (err: any) {
                    setError(err?.message ?? "Failed to delete staff member");
                  }
                }}
                className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500"
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function apiBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5002";
}

async function patchStaff(id: string, body: Record<string, unknown>) {
  const res = await fetch(`${apiBase()}/api/staff/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error("Failed to update staff member");
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const dt = new Date(value);
  return isNaN(dt.getTime()) ? "—" : dt.toLocaleDateString();
}

function Header({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">{children}</th>;
}

function Cell({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 text-slate-800">{children}</td>;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-rose-600"> *</span>}
      </label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
      />
    </div>
  );
}

function LoadingCard() {
  return <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">Loading staff...</div>;
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
      Failed to load staff: {message}
    </div>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
