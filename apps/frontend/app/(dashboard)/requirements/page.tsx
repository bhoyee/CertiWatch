"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchJson, postJson } from "../../../lib/api";

type RequirementTypeDto = {
  id: string;
  tenantId: string | null;
  name: string;
  defaultValidityMonths: number | null;
  isRenewable: boolean;
  isGlobal: boolean;
};

type CreateRequirementType = {
  name: string;
  defaultValidityMonths: string;
  isRenewable: boolean;
};

export default function RequirementsPage() {
  const [types, setTypes] = useState<RequirementTypeDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState<"all" | "global" | "tenant">("all");
  const [sort, setSort] = useState<{ key: "name" | "validity" | "scope"; dir: "asc" | "desc" }>({
    key: "name",
    dir: "asc"
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editing, setEditing] = useState<RequirementTypeDto | null>(null);
  const [editForm, setEditForm] = useState<CreateRequirementType | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<RequirementTypeDto | null>(null);
  const [form, setForm] = useState<CreateRequirementType>({
    name: "",
    defaultValidityMonths: "",
    isRenewable: true
  });

  useEffect(() => {
    fetchJson<RequirementTypeDto[]>("/api/requirement-types")
      .then(setTypes)
      .catch((err) => setError(err.message ?? "Failed to load requirements"));
  }, []);

  const filtered = useMemo(() => {
    if (!types) return [];
    const term = search.trim().toLowerCase();
    return types.filter((t) => {
      if (scopeFilter === "global" && !t.isGlobal) return false;
      if (scopeFilter === "tenant" && t.isGlobal) return false;
      if (!term) return true;
      return t.name.toLowerCase().includes(term);
    });
  }, [types, scopeFilter, search]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      switch (sort.key) {
        case "name":
          return a.name.localeCompare(b.name) * dir;
        case "validity":
          return ((a.defaultValidityMonths ?? 0) - (b.defaultValidityMonths ?? 0)) * dir;
        case "scope":
          return (a.isGlobal === b.isGlobal ? 0 : a.isGlobal ? -1 : 1) * dir;
        default:
          return 0;
      }
    });
    return list;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const visible = sorted.slice(start, start + pageSize);

  const setSortKey = (key: typeof sort.key) => {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  };

  if (error) return <ErrorCard message={error} />;
  if (!types) return <LoadingCard />;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Requirements</h1>
            <p className="text-sm text-slate-600">
              The credentials every staff member is checked against — pre-seeded for care providers, plus anything you add yourself.
            </p>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search requirements..."
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none md:w-64"
            />
            <select
              value={scopeFilter}
              onChange={(e) => {
                setScopeFilter(e.target.value as any);
                setPage(1);
              }}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All scopes</option>
              <option value="global">Global</option>
              <option value="tenant">Custom</option>
            </select>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              {[10, 25, 50].map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <Header onClick={() => setSortKey("name")} sorted={sort.key === "name"} dir={sort.dir}>
                  Requirement
                </Header>
                <Header onClick={() => setSortKey("validity")} sorted={sort.key === "validity"} dir={sort.dir}>
                  Validity (months)
                </Header>
                <Header>Renewable</Header>
                <Header onClick={() => setSortKey("scope")} sorted={sort.key === "scope"} dir={sort.dir}>
                  Scope
                </Header>
                <Header>Actions</Header>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {visible.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <Cell>{t.name}</Cell>
                  <Cell>
                    {t.defaultValidityMonths ?? (t.isRenewable ? "Varies per person" : "One-time")}
                  </Cell>
                  <Cell>{t.isRenewable ? "Yes" : "No"}</Cell>
                  <Cell>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        t.isGlobal ? "bg-emerald-600 text-white" : "bg-slate-900 text-white"
                      }`}
                    >
                      {t.isGlobal ? "Global" : "Custom"}
                    </span>
                  </Cell>
                  <Cell>
                    <div className="flex items-center gap-2">
                      <button
                        disabled={t.isGlobal}
                        onClick={() => {
                          setEditing(t);
                          setEditForm({
                            name: t.name,
                            defaultValidityMonths: t.defaultValidityMonths?.toString() ?? "",
                            isRenewable: t.isRenewable
                          });
                        }}
                        className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                          t.isGlobal
                            ? "cursor-not-allowed border-slate-200 text-slate-400"
                            : "border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                        title={t.isGlobal ? "Global requirements are locked" : "Edit requirement"}
                      >
                        Edit
                      </button>
                      <button
                        disabled={t.isGlobal}
                        onClick={() => setConfirmDelete(t)}
                        className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                          t.isGlobal
                            ? "cursor-not-allowed border-slate-200 text-slate-400"
                            : "border-rose-200 text-rose-700 hover:bg-rose-50"
                        }`}
                        title={t.isGlobal ? "Global requirements are locked" : "Delete requirement"}
                      >
                        Delete
                      </button>
                      {t.isGlobal && (
                        <span className="inline-flex items-center text-xs text-slate-500" title="Global requirement (locked)">
                          🔒
                        </span>
                      )}
                    </div>
                  </Cell>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-sm text-slate-500">
                    No requirements match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-col gap-2 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
          <span>
            Showing {sorted.length === 0 ? 0 : start + 1}–{Math.min(sorted.length, start + pageSize)} of {sorted.length}{" "}
            requirements
          </span>
          <div className="flex items-center gap-2">
            <button
              className="rounded-md border border-slate-200 px-3 py-1 text-sm font-medium text-slate-700 disabled:opacity-50"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            <span className="text-slate-700">
              Page {currentPage} / {totalPages}
            </span>
            <button
              className="rounded-md border border-slate-200 px-3 py-1 text-sm font-medium text-slate-700 disabled:opacity-50"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-md font-semibold text-slate-900">Add a requirement</h2>
        <p className="text-sm text-slate-600">Add a local credential the seeded catalog doesn't cover.</p>
        <form
          className="mt-4 grid gap-4 md:grid-cols-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setCreating(true);
            setError(null);
            try {
              const body: any = {
                name: form.name.trim(),
                defaultValidityMonths: form.defaultValidityMonths ? Number(form.defaultValidityMonths) : null,
                isRenewable: form.isRenewable
              };
              await postJson("/api/requirement-types", body);
              const refreshed = await fetchJson<RequirementTypeDto[]>("/api/requirement-types");
              setTypes(refreshed);
              setForm({ name: "", defaultValidityMonths: "", isRenewable: true });
            } catch (err: any) {
              setError(err.message ?? "Failed to create requirement");
            } finally {
              setCreating(false);
            }
          }}
        >
          <Field
            label="Requirement name"
            required
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            placeholder="Epilepsy Awareness"
          />
          <Field
            label="Validity (months)"
            value={form.defaultValidityMonths}
            onChange={(v) => setForm({ ...form, defaultValidityMonths: v })}
            placeholder="Leave blank if there's no fixed renewal period"
            type="number"
          />
          <Checkbox
            label="Renewable"
            checked={form.isRenewable}
            onChange={(v) => setForm({ ...form, isRenewable: v })}
          />
          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={creating || !form.name.trim()}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
            >
              {creating ? "Saving..." : "Save requirement"}
            </button>
            {error && <span className="ml-3 text-sm text-rose-700">{error}</span>}
          </div>
        </form>
      </div>

      {editing && editForm && (
        <Modal onClose={() => (!savingEdit ? setEditing(null) : null)} title="Edit requirement">
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!editing) return;
              setSavingEdit(true);
              setError(null);
              try {
                const body: any = {
                  name: editForm.name.trim(),
                  defaultValidityMonths: editForm.defaultValidityMonths ? Number(editForm.defaultValidityMonths) : null,
                  isRenewable: editForm.isRenewable
                };
                await fetch(`/api/requirement-types/${editing.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(body)
                }).then((res) => {
                  if (!res.ok) throw new Error("Failed to update requirement");
                });
                const refreshed = await fetchJson<RequirementTypeDto[]>("/api/requirement-types");
                setTypes(refreshed);
                setEditing(null);
                setEditForm(null);
              } catch (err: any) {
                setError(err.message ?? "Failed to update requirement");
              } finally {
                setSavingEdit(false);
              }
            }}
          >
            <Field
              label="Requirement name"
              required
              value={editForm.name}
              onChange={(v) => setEditForm({ ...editForm, name: v })}
              placeholder="Epilepsy Awareness"
            />
            <Field
              label="Validity (months)"
              value={editForm.defaultValidityMonths}
              onChange={(v) => setEditForm({ ...editForm, defaultValidityMonths: v })}
              placeholder="Leave blank if there's no fixed renewal period"
              type="number"
            />
            <Checkbox
              label="Renewable"
              checked={editForm.isRenewable}
              onChange={(v) => setEditForm({ ...editForm, isRenewable: v })}
            />
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
        <Modal onClose={() => setConfirmDelete(null)} title="Delete requirement?">
          <div className="space-y-3">
            <p className="text-sm text-slate-700">
              This will permanently delete “{confirmDelete.name}”. This cannot be undone.
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
                    const res = await fetch(`/api/requirement-types/${confirmDelete.id}`, { method: "DELETE" });
                    if (!res.ok) throw new Error("Failed to delete requirement");
                    const refreshed = await fetchJson<RequirementTypeDto[]>("/api/requirement-types");
                    setTypes(refreshed);
                    setConfirmDelete(null);
                  } catch (err: any) {
                    setError(err.message ?? "Failed to delete requirement");
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

function Header({
  children,
  onClick,
  sorted,
  dir
}: {
  children: React.ReactNode;
  onClick?: () => void;
  sorted?: boolean;
  dir?: "asc" | "desc";
}) {
  return (
    <th
      className={`px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 ${
        onClick ? "cursor-pointer select-none" : ""
      }`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      <div className="flex items-center gap-1">
        <span>{children}</span>
        {sorted && <span className="text-slate-400">{dir === "asc" ? "▲" : "▼"}</span>}
      </div>
    </th>
  );
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

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center space-x-2 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
      />
      <span>{label}</span>
    </label>
  );
}

function LoadingCard() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
      Loading requirements…
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
      Failed to load requirements: {message}
    </div>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
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
