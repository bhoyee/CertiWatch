"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { deleteJson, fetchJson, postJson, patchJson } from "../../../lib/api";
import { useToast } from "../Toast";

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

const COLUMN_KEYS = ["name", "validity", "renewable", "scope", "actions"] as const;
type ColumnKey = (typeof COLUMN_KEYS)[number];
// Widths are percentages of the table (not px) that always sum to 100 - resizing a column
// borrows/gives space to its neighbor rather than growing the table itself, so the table never
// exceeds its container and never needs a horizontal scrollbar just from resizing.
const DEFAULT_COL_WIDTHS: Record<ColumnKey, number> = {
  name: 34,
  validity: 20,
  renewable: 15,
  scope: 15,
  actions: 16
};
const MIN_COL_PCT = 8;
const COL_WIDTHS_STORAGE_KEY = "cw_requirements_col_widths_v1";

export default function RequirementsPage() {
  return (
    <Suspense fallback={<LoadingCard />}>
      <RequirementsPageInner />
    </Suspense>
  );
}

function RequirementsPageInner() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const addFormRef = useRef<HTMLDivElement>(null);
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
  const [colWidths, setColWidths] = useState<Record<ColumnKey, number>>(() => {
    if (typeof window === "undefined") return DEFAULT_COL_WIDTHS;
    try {
      const saved = window.localStorage.getItem(COL_WIDTHS_STORAGE_KEY);
      return saved ? { ...DEFAULT_COL_WIDTHS, ...JSON.parse(saved) } : DEFAULT_COL_WIDTHS;
    } catch {
      return DEFAULT_COL_WIDTHS;
    }
  });
  const tableWrapperRef = useRef<HTMLDivElement>(null);

  // Column resizing redistributes width between the dragged column and its neighbor (dragging the
  // last column's handle borrows from the one before it instead, since it has no "next"), so the
  // pair's combined width - and therefore the table's total width - never changes. That's what
  // keeps the table exactly at the container's width with no horizontal scrollbar, matching the
  // same resizing behavior as the Records and Staff tables.
  const startResize = (key: ColumnKey) => (e: React.PointerEvent) => {
    e.preventDefault();
    const idx = COLUMN_KEYS.indexOf(key);
    const isLast = idx === COLUMN_KEYS.length - 1;
    const neighborKey = isLast ? COLUMN_KEYS[idx - 1] : COLUMN_KEYS[idx + 1];
    if (!neighborKey) return;

    const containerWidth = tableWrapperRef.current?.clientWidth || 1000;
    const startX = e.clientX;
    const startOwn = colWidths[key];
    const startNeighbor = colWidths[neighborKey];
    const pairTotal = startOwn + startNeighbor;

    const onMove = (moveEvent: PointerEvent) => {
      const deltaPct = ((moveEvent.clientX - startX) / containerWidth) * 100;
      const signedDelta = isLast ? -deltaPct : deltaPct;
      let nextOwn = startOwn + signedDelta;
      let nextNeighbor = pairTotal - nextOwn;
      if (nextOwn < MIN_COL_PCT) {
        nextOwn = MIN_COL_PCT;
        nextNeighbor = pairTotal - nextOwn;
      } else if (nextNeighbor < MIN_COL_PCT) {
        nextNeighbor = MIN_COL_PCT;
        nextOwn = pairTotal - nextNeighbor;
      }
      setColWidths((prev) => ({ ...prev, [key]: nextOwn, [neighborKey]: nextNeighbor }));
    };
    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      setColWidths((prev) => {
        try {
          window.localStorage.setItem(COL_WIDTHS_STORAGE_KEY, JSON.stringify(prev));
        } catch {
          // Best-effort - resizing still works for the rest of the session either way.
        }
        return prev;
      });
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };

  useEffect(() => {
    fetchJson<RequirementTypeDto[]>("/api/requirement-types")
      .then(setTypes)
      .catch((err) => setError(err.message ?? "Failed to load requirements"));
  }, []);

  // Landing here from the Review page's "add as new requirement" link (?name=...) pre-fills the
  // name so the reviewer doesn't have to retype what the document already told us, and scrolls the
  // always-visible "Add a requirement" form into view since it sits below the table.
  useEffect(() => {
    const name = searchParams?.get("name");
    if (!name) return;
    setForm((f) => ({ ...f, name }));
    addFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
      <ReminderSettingsCard />
      <ManagerVisibilityCard />

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
        <div ref={tableWrapperRef}>
          {/* Column widths are percentages that always sum to 100 (see startResize) and the table
              is w-full, so it always exactly fills this wrapper - no horizontal scrolling, just
              like the Records and Staff tables. */}
          <table className="w-full divide-y divide-slate-200 text-sm" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: `${colWidths.name}%` }} />
              <col style={{ width: `${colWidths.validity}%` }} />
              <col style={{ width: `${colWidths.renewable}%` }} />
              <col style={{ width: `${colWidths.scope}%` }} />
              <col style={{ width: `${colWidths.actions}%` }} />
            </colgroup>
            <thead className="bg-slate-100">
              <tr>
                <Header
                  onClick={() => setSortKey("name")}
                  sorted={sort.key === "name"}
                  dir={sort.dir}
                  onResizeStart={startResize("name")}
                >
                  Requirement
                </Header>
                <Header
                  onClick={() => setSortKey("validity")}
                  sorted={sort.key === "validity"}
                  dir={sort.dir}
                  onResizeStart={startResize("validity")}
                >
                  Validity (months)
                </Header>
                <Header onResizeStart={startResize("renewable")}>Renewable</Header>
                <Header
                  onClick={() => setSortKey("scope")}
                  sorted={sort.key === "scope"}
                  dir={sort.dir}
                  onResizeStart={startResize("scope")}
                >
                  Scope
                </Header>
                <Header onResizeStart={startResize("actions")}>Actions</Header>
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

      <div ref={addFormRef} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
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
              toast.success(`"${body.name}" added to your requirements.`);
              setForm({ name: "", defaultValidityMonths: "", isRenewable: true });
            } catch (err: any) {
              const message = err.message ?? "Failed to create requirement";
              setError(message);
              toast.error(message);
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
                const body = {
                  name: editForm.name.trim(),
                  defaultValidityMonths: editForm.defaultValidityMonths ? Number(editForm.defaultValidityMonths) : null,
                  isRenewable: editForm.isRenewable
                };
                await patchJson(`/api/requirement-types/${editing.id}`, body);
                const refreshed = await fetchJson<RequirementTypeDto[]>("/api/requirement-types");
                setTypes(refreshed);
                toast.success(`"${body.name}" updated.`);
                setEditing(null);
                setEditForm(null);
              } catch (err: any) {
                const message = err.message ?? "Failed to update requirement";
                setError(message);
                toast.error(message);
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
                    await deleteJson(`/api/requirement-types/${confirmDelete.id}`);
                    const refreshed = await fetchJson<RequirementTypeDto[]>("/api/requirement-types");
                    setTypes(refreshed);
                    toast.success(`"${confirmDelete.name}" deleted.`);
                    setConfirmDelete(null);
                  } catch (err: any) {
                    const message = err.message ?? "Failed to delete requirement";
                    setError(message);
                    toast.error(message);
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
  dir,
  onResizeStart
}: {
  children: React.ReactNode;
  onClick?: () => void;
  sorted?: boolean;
  dir?: "asc" | "desc";
  onResizeStart?: (e: React.PointerEvent) => void;
}) {
  return (
    <th className="relative border-b-2 border-r-2 border-slate-300 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 last:border-r-0">
      <span
        onClick={onClick}
        className={`inline-flex items-center gap-1 ${onClick ? "cursor-pointer select-none hover:text-slate-900" : ""}`}
      >
        {children}
        {sorted && <span className="text-slate-400">{dir === "asc" ? "▲" : "▼"}</span>}
      </span>
      {onResizeStart && (
        // The border-r above marks where columns divide; this handle just widens the grabbable
        // area around that same line and highlights it on hover/drag so it reads as draggable.
        <div
          onPointerDown={onResizeStart}
          aria-hidden="true"
          className="absolute right-0 top-0 h-full w-2 cursor-col-resize touch-none select-none hover:bg-indigo-300/60 active:bg-indigo-400/70"
        />
      )}
    </th>
  );
}

function Cell({ children }: { children: React.ReactNode }) {
  return <td className="break-words px-3 py-2 text-slate-800">{children}</td>;
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

type ReminderSettings = { leadDays: number[]; isCustom: boolean; defaultLeadDays: number[] };

// Tenant-wide "how many days before expiry do we alert" schedule - admin-only, same gate as the
// requirement types below. Every tenant used to share one hardcoded schedule (60/30/7/1 days);
// this lets an org override it while defaulting to that same schedule if they never touch it.
// Mirrors ReminderLeadDays' constants on the API (apps/api/Infrastructure/Jobs/ReminderLeadDays.cs)
// so a bad value is caught the instant you leave the field instead of only after a round trip -
// there's no shared contracts constant for these since that class is internal to the API.
const MIN_LEAD_DAYS = 1;
const MAX_LEAD_DAYS = 365;
const MAX_LEAD_COUNT = 8;

function parseLeadDaysDraft(draft: string): { values: number[]; error?: undefined } | { values?: undefined; error: string } {
  const parts = draft
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return { error: "Enter at least one number of days, e.g. 60, 30, 7, 1." };
  }
  const parsed = parts.map((p) => Number(p));
  if (parsed.some((n) => !Number.isInteger(n))) {
    return { error: "Use whole numbers only, separated by commas — e.g. 60, 30, 7, 1." };
  }
  if (parsed.some((n) => n < MIN_LEAD_DAYS || n > MAX_LEAD_DAYS)) {
    return { error: `Each value must be between ${MIN_LEAD_DAYS} and ${MAX_LEAD_DAYS} days.` };
  }
  const deduped = Array.from(new Set(parsed));
  if (deduped.length > MAX_LEAD_COUNT) {
    return { error: `Use ${MAX_LEAD_COUNT} or fewer values — that's plenty of advance warning.` };
  }
  return { values: deduped };
}

function ReminderSettingsCard() {
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [draft, setDraft] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = () => {
    fetchJson<ReminderSettings>("/api/tenant/reminder-settings")
      .then((data) => {
        setSettings(data);
        setDraft(data.leadDays.join(", "));
        setLoadError(null);
      })
      .catch((err) => setLoadError(err.message ?? "Failed to load reminder settings"));
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    const result = parseLeadDaysDraft(draft);
    if (result.error) {
      setSaveError(result.error);
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const updated = await patchJson<ReminderSettings, Record<string, unknown>>("/api/tenant/reminder-settings", {
        leadDays: result.values
      });
      setSettings(updated);
      setDraft(updated.leadDays.join(", "));
      setSaved(true);
    } catch (err: any) {
      // Falls back to whatever the API returned (e.g. a range/count rule this client-side check
      // doesn't happen to catch) - the two are meant to agree, but the server is the last word.
      setSaveError(err?.message ?? "Failed to save reminder settings");
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = async () => {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const updated = await patchJson<ReminderSettings, Record<string, unknown>>("/api/tenant/reminder-settings", {
        leadDays: null
      });
      setSettings(updated);
      setDraft(updated.leadDays.join(", "));
      setSaved(true);
    } catch (err: any) {
      setSaveError(err?.message ?? "Failed to reset reminder settings");
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
        Failed to load reminder settings: {loadError}
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
        Loading reminder settings…
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-md font-semibold text-slate-900">Reminder timing</h2>
      <p className="mt-1 text-sm text-slate-600">
        How many days before something expires should we send an alert — comma-separated, e.g. "60, 30, 7, 1" sends
        four alerts counting down to the deadline.{" "}
        {settings.isCustom ? (
          "You're using a custom schedule."
        ) : (
          <>Currently the default ({settings.defaultLeadDays.join(", ")} days).</>
        )}
      </p>
      <p className="mt-1 text-xs text-slate-400">
        Whole numbers, {MIN_LEAD_DAYS}–{MAX_LEAD_DAYS} days each, up to {MAX_LEAD_COUNT} values.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setSaved(false);
            if (saveError) setSaveError(null);
          }}
          placeholder="60, 30, 7, 1"
          aria-invalid={saveError ? true : undefined}
          className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none sm:max-w-sm ${
            saveError ? "border-rose-300 focus:border-rose-500" : "border-slate-200 focus:border-blue-500"
          }`}
        />
        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {settings.isCustom && (
            <button
              onClick={resetToDefault}
              disabled={saving}
              className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
            >
              Reset to default
            </button>
          )}
        </div>
      </div>
      {saveError && <p className="mt-2 text-sm text-rose-700">{saveError}</p>}
      {saved && !saveError && (
        <p className="mt-2 text-sm text-emerald-700">Saved — applies to every reminder scheduled from now on.</p>
      )}
    </div>
  );
}

// Whether a manager sees every tenant record (Records, Review, Compliance) or only records they
// (or a viewer they invited) uploaded themselves - see RecordVisibility.GetScopeAsync on the API.
// Defaults to the scoped behavior for every tenant; this is purely an admin's trust decision, not
// something that should silently change.
function ManagerVisibilityCard() {
  const [seesAll, setSeesAll] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchJson<{ managerSeesAllRecords: boolean }>("/api/tenant/manager-visibility")
      .then((data) => {
        setSeesAll(data.managerSeesAllRecords);
        setLoadError(null);
      })
      .catch((err) => setLoadError(err.message ?? "Failed to load manager visibility setting"));
  }, []);

  const update = (value: boolean) => {
    if (value === seesAll) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    patchJson<{ managerSeesAllRecords: boolean }, Record<string, unknown>>("/api/tenant/manager-visibility", {
      managerSeesAllRecords: value
    })
      .then((res) => {
        setSeesAll(res.managerSeesAllRecords);
        setSaved(true);
      })
      .catch((err: any) => setSaveError(err?.message ?? "Failed to update manager visibility"))
      .finally(() => setSaving(false));
  };

  if (loadError) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
        Failed to load manager visibility setting: {loadError}
      </div>
    );
  }

  if (seesAll === null) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
        Loading manager visibility setting…
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-md font-semibold text-slate-900">Manager visibility</h2>
      <p className="mt-1 text-sm text-slate-600">
        What managers can see on Records, Review, and Compliance — this is a trust decision for
        your organization, not something managers can change themselves.
      </p>
      <div className="mt-4 space-y-2">
        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 p-3 hover:bg-slate-50">
          <input
            type="radio"
            name="manager-visibility"
            checked={!seesAll}
            onChange={() => update(false)}
            disabled={saving}
            className="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-500"
          />
          <span>
            <span className="block text-sm font-semibold text-slate-900">Only their own scope (default)</span>
            <span className="block text-xs text-slate-500">
              A manager sees records they uploaded, records from a device or cloud drive they set up, and anything
              uploaded by a viewer they personally invited.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 p-3 hover:bg-slate-50">
          <input
            type="radio"
            name="manager-visibility"
            checked={seesAll}
            onChange={() => update(true)}
            disabled={saving}
            className="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-500"
          />
          <span>
            <span className="block text-sm font-semibold text-slate-900">Every record in the organization</span>
            <span className="block text-xs text-slate-500">
              A manager sees the same full record set an admin does. Viewers are never affected by this setting.
            </span>
          </span>
        </label>
      </div>
      {saveError && <p className="mt-2 text-sm text-rose-700">{saveError}</p>}
      {saved && !saveError && <p className="mt-2 text-sm text-emerald-700">Saved.</p>}
    </div>
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
