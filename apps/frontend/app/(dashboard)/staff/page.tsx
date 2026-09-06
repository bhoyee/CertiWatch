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

type ImportRow = { name: string; jobTitle: string; startDate: string };
type ImportResult = { imported: number; skipped: { row: number; reason: string }[] };

const emptyForm: StaffForm = { name: "", jobTitle: "", startDate: "" };

// Minimal CSV parser - handles quoted fields (so a job title containing a comma still works)
// without pulling in a library for what's a small, well-defined format.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function toIsoDate(value: string): string {
  if (!value.trim()) return "";
  const dt = new Date(value.trim());
  return isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
}

function parseStaffCsv(text: string): ImportRow[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];

  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, ""));
  const nameIdx = header.findIndex((h) => h === "name" || h === "fullname");
  const jobIdx = header.findIndex((h) => h === "jobtitle" || h === "role" || h === "title");
  const startIdx = header.findIndex((h) => h === "startdate" || h === "start");

  // No recognizable header - treat every row (including the first) as data, name-only.
  const dataRows = nameIdx === -1 ? rows : rows.slice(1);
  const effectiveNameIdx = nameIdx === -1 ? 0 : nameIdx;

  return dataRows
    .map((r) => ({
      name: (r[effectiveNameIdx] ?? "").trim(),
      jobTitle: jobIdx >= 0 ? (r[jobIdx] ?? "").trim() : "",
      startDate: startIdx >= 0 ? toIsoDate(r[startIdx] ?? "") : ""
    }))
    .filter((r) => r.name);
}

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMemberDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("active");
  const [sort, setSort] = useState<{ key: "name" | "jobTitle" | "startDate" | "status"; dir: "asc" | "desc" }>({
    key: "name",
    dir: "asc"
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [form, setForm] = useState<StaffForm>(emptyForm);
  const [editing, setEditing] = useState<StaffMemberDto | null>(null);
  const [editForm, setEditForm] = useState<StaffForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<StaffMemberDto | null>(null);
  const [importRows, setImportRows] = useState<ImportRow[] | null>(null);
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

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
      if (statusFilter === "active" && !s.isActive) return false;
      if (statusFilter === "inactive" && s.isActive) return false;
      if (!term) return true;
      return s.name.toLowerCase().includes(term) || (s.jobTitle ?? "").toLowerCase().includes(term);
    });
  }, [staff, search, statusFilter]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      switch (sort.key) {
        case "name":
          return a.name.localeCompare(b.name) * dir;
        case "jobTitle":
          return (a.jobTitle ?? "").localeCompare(b.jobTitle ?? "") * dir;
        case "startDate":
          return ((a.startDate ?? "") > (b.startDate ?? "") ? 1 : (a.startDate ?? "") < (b.startDate ?? "") ? -1 : 0) * dir;
        case "status":
          return (a.isActive === b.isActive ? 0 : a.isActive ? -1 : 1) * dir;
        default:
          return 0;
      }
    });
    return list;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const visible = sorted.slice(pageStart, pageStart + pageSize);

  const setSortKey = (key: typeof sort.key) => {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  };

  const handleFileSelect = async (file: File) => {
    setImportError(null);
    setImportResult(null);
    try {
      const text = await file.text();
      const rows = parseStaffCsv(text);
      if (rows.length === 0) {
        setImportError("No rows found — make sure the file has a \"name\" column (job title and start date are optional).");
        setImportRows(null);
        setImportFileName(null);
        return;
      }
      setImportRows(rows);
      setImportFileName(file.name);
    } catch {
      setImportError("Couldn't read that file. Make sure it's a plain CSV export.");
    }
  };

  const confirmImport = async () => {
    if (!importRows) return;
    setImporting(true);
    setImportError(null);
    try {
      const result = await postJson<ImportResult, Record<string, unknown>>("/api/staff/import", {
        rows: importRows.map((r) => ({
          name: r.name,
          jobTitle: r.jobTitle || null,
          startDate: r.startDate || null
        }))
      });
      setImportResult(result);
      setImportRows(null);
      setImportFileName(null);
      load();
    } catch (err: any) {
      setImportError(err?.message ?? "Failed to import staff");
    } finally {
      setImporting(false);
    }
  };

  if (error) return <ErrorCard message={error} />;
  if (!staff) return <LoadingCard />;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-md font-semibold text-slate-900">Import from CSV</h2>
            <p className="text-sm text-slate-600">
              A "name" column is required — "job title" and "start date" are optional. Excel: File → Save As → CSV.
            </p>
          </div>
          <a
            href={`data:text/csv;charset=utf-8,${encodeURIComponent("name,job title,start date\nJane Doe,Carer,2024-03-01\n")}`}
            download="staff-template.csv"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            Download template
          </a>
        </div>

        <div className="mt-4">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
              e.target.value = "";
            }}
            className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border file:border-slate-200 file:bg-slate-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-100"
          />
          {importError && <p className="mt-2 text-sm text-rose-700">{importError}</p>}

          {importRows && (
            <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm text-slate-700">
                <span className="font-semibold">{importFileName}</span> — found {importRows.length} row
                {importRows.length === 1 ? "" : "s"} ready to import.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={confirmImport}
                  disabled={importing}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
                >
                  {importing ? "Importing..." : `Import ${importRows.length} staff member${importRows.length === 1 ? "" : "s"}`}
                </button>
                <button
                  onClick={() => {
                    setImportRows(null);
                    setImportFileName(null);
                  }}
                  disabled={importing}
                  className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {importResult && (
            <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <p className="font-semibold">Imported {importResult.imported} staff member{importResult.imported === 1 ? "" : "s"}.</p>
              {importResult.skipped.length > 0 && (
                <>
                  <p className="mt-2 font-semibold text-slate-700">
                    Skipped {importResult.skipped.length} row{importResult.skipped.length === 1 ? "" : "s"}:
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-700">
                    {importResult.skipped.map((s, i) => (
                      <li key={i}>
                        Row {s.row}: {s.reason}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
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

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Staff</h1>
            <p className="text-sm text-slate-600">
              Everyone you're tracking compliance for — including anyone who hasn't had a certificate uploaded yet.
            </p>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search name, role..."
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none md:w-64"
            />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setPage(1);
              }}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
              <option value="all">All statuses</option>
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

        {/* Table: md and up */}
        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <Header onClick={() => setSortKey("name")} sorted={sort.key === "name"} dir={sort.dir}>
                  Name
                </Header>
                <Header onClick={() => setSortKey("jobTitle")} sorted={sort.key === "jobTitle"} dir={sort.dir}>
                  Job title
                </Header>
                <Header onClick={() => setSortKey("startDate")} sorted={sort.key === "startDate"} dir={sort.dir}>
                  Start date
                </Header>
                <Header onClick={() => setSortKey("status")} sorted={sort.key === "status"} dir={sort.dir}>
                  Status
                </Header>
                <Header>Actions</Header>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {visible.map((s) => (
                <tr key={s.id} className={s.isActive ? "hover:bg-slate-50" : "bg-slate-50/60 hover:bg-slate-50"}>
                  <Cell muted={!s.isActive}>{s.name}</Cell>
                  <Cell muted={!s.isActive}>{s.jobTitle ?? "—"}</Cell>
                  <Cell muted={!s.isActive}>{formatDate(s.startDate)}</Cell>
                  <Cell>
                    <StatusPill isActive={s.isActive} />
                  </Cell>
                  <Cell>
                    <RowActions
                      staff={s}
                      onEdit={() => {
                        setEditing(s);
                        setEditForm({ name: s.name, jobTitle: s.jobTitle ?? "", startDate: s.startDate ?? "" });
                      }}
                      onToggleActive={async () => {
                        try {
                          await patchStaff(s.id, { isActive: !s.isActive });
                          load();
                        } catch (err: any) {
                          setError(err?.message ?? "Failed to update staff member");
                        }
                      }}
                      onDelete={() => setConfirmDelete(s)}
                    />
                  </Cell>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-sm text-slate-500">
                    {staff.length === 0 ? "No staff added yet — add your first one below." : "No staff match your filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Cards: below md */}
        <div className="space-y-3 md:hidden">
          {visible.map((s) => (
            <div key={s.id} className={`rounded-lg border border-slate-200 p-3 ${s.isActive ? "" : "bg-slate-50/60"}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className={`font-semibold ${s.isActive ? "text-slate-900" : "text-slate-400 line-through decoration-slate-400"}`}>
                    {s.name}
                  </p>
                  <p className={`text-sm ${s.isActive ? "text-slate-600" : "text-slate-400 line-through decoration-slate-400"}`}>
                    {s.jobTitle ?? "—"}
                  </p>
                </div>
                <StatusPill isActive={s.isActive} />
              </div>
              <p className="mt-2 text-xs text-slate-500">Started {formatDate(s.startDate)}</p>
              <div className="mt-3">
                <RowActions
                  staff={s}
                  onEdit={() => {
                    setEditing(s);
                    setEditForm({ name: s.name, jobTitle: s.jobTitle ?? "", startDate: s.startDate ?? "" });
                  }}
                  onToggleActive={async () => {
                    try {
                      await patchStaff(s.id, { isActive: !s.isActive });
                      load();
                    } catch (err: any) {
                      setError(err?.message ?? "Failed to update staff member");
                    }
                  }}
                  onDelete={() => setConfirmDelete(s)}
                />
              </div>
            </div>
          ))}
          {visible.length === 0 && (
            <p className="px-1 py-4 text-center text-sm text-slate-500">
              {staff.length === 0 ? "No staff added yet — add your first one below." : "No staff match your filters."}
            </p>
          )}
        </div>

        {sorted.length > 0 && (
          <div className="mt-3 flex flex-col gap-2 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
            <span>
              Showing {pageStart + 1}–{Math.min(sorted.length, pageStart + pageSize)} of {sorted.length} staff
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
        )}
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

function Cell({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <td className={`px-3 py-2 ${muted ? "text-slate-400 line-through decoration-slate-400" : "text-slate-800"}`}>
      {children}
    </td>
  );
}

function StatusPill({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
        isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
      }`}
    >
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

function RowActions({
  staff,
  onEdit,
  onToggleActive,
  onDelete
}: {
  staff: StaffMemberDto;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        onClick={onEdit}
        className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
      >
        Edit
      </button>
      <button
        onClick={onToggleActive}
        className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
      >
        {staff.isActive ? "Deactivate" : "Reactivate"}
      </button>
      <button
        onClick={onDelete}
        className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
      >
        Delete
      </button>
    </div>
  );
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
