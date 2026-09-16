"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchJson, patchJson, deleteJson } from "../../../lib/api";
import { useRole } from "../RoleContext";

type RecordDto = {
  id: string;
  staffName: string;
  courseName: string;
  issuer?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  expiryDerived?: boolean;
  confidence?: number;
  extractionConfidence?: number | null;
  processingStatus: number | string;
  reviewReason?: string | null;
  reviewNotes?: string | null;
  fields?: Record<string, string>;
  createdAt?: string;
  updatedAt?: string;
};

type DocumentDto = {
  id: string;
  fileName: string;
  pathOrUrl?: string | null;
  mimeType: string;
  processingStatus: number;
  createdAt: string;
  processedAt?: string | null;
  documentType?: string | null;
  extractionConfidence?: number | null;
};

type RecordDetailDto = {
  record: RecordDto;
  document: DocumentDto;
  reminders: unknown[];
  auditTrail: unknown[];
  suggestedActions: string[];
};

type PagedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

const NEEDS_REVIEW = 2; // ProcessingStatus.NeedsReview
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5002";

type QueueSortField = "staffName" | "courseName" | "issueDate" | "expiryDate" | "confidence";

export default function ReviewQueuePage() {
  return (
    <Suspense fallback={<div className="cw-card p-6 text-sm text-slate-600">Loading review queue...</div>}>
      <ReviewQueuePageInner />
    </Suspense>
  );
}

function ReviewQueuePageInner() {
  const { role } = useRole();
  const searchParams = useSearchParams();
  const isViewer = role?.toLowerCase() === "viewer";
  const [records, setRecords] = useState<RecordDto[]>([]);
  const [queueSearch, setQueueSearch] = useState("");
  const [queueSortField, setQueueSortField] = useState<QueueSortField>("staffName");
  const [queueSortDir, setQueueSortDir] = useState<"asc" | "desc">("asc");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams?.get("recordId") ?? null);
  const [detail, setDetail] = useState<RecordDetailDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const lastDetailHash = useRef<string | null>(null);
  const detailSectionRef = useRef<HTMLElement>(null);
  const [requirementTypeNames, setRequirementTypeNames] = useState<string[]>([]);

  // Best-effort: powers a suggestion list on the Requirement type field so a reviewer can match
  // a document's own wording (e.g. a council's certificate titled differently) to the tenant's
  // actual catalog entry instead of having to know/retype it exactly. 403s for managers (this
  // endpoint is admin-only) are fine to swallow - the field just falls back to plain free text.
  useEffect(() => {
    if (isViewer) return;
    fetchJson<Array<{ name: string }>>("/api/requirement-types")
      .then((types) => setRequirementTypeNames(types.map((t) => t.name).filter(Boolean)))
      .catch(() => setRequirementTypeNames([]));
  }, [isViewer]);
  // Clicking "View" on a record in the Records table links here with ?recordId=... - honor that
  // exact record on the first load even if it isn't in the needs-review queue (e.g. it's since
  // been approved elsewhere), rather than the queue's own load() immediately overwriting it with
  // whatever happens to be first in the list. Only applies once; later refreshes fall back to the
  // normal "stay selected if still in the queue, else pick the first item" behavior.
  const deepLinkPendingRef = useRef<boolean>(!!searchParams?.get("recordId"));

  const [pendingCount, setPendingCount] = useState(0);

  const load = useCallback(() => {
    if (isViewer) {
      setRecords([]);
      setError("Review queue is admin/manager only.");
      return;
    }
    setLoading(true);
    // A document that's still being OCR'd/extracted (ProcessingStatus.Pending) hasn't been
    // flagged as needs-review yet, so it never appears in the list below at all - fetched
    // alongside the real queue purely to power the "N still processing" banner, so uploading a
    // large batch doesn't look like nothing is happening while it works through the backlog.
    Promise.all([
      // Filtering server-side by status (rather than fetching an arbitrary top-N and filtering in
      // the browser) is what guarantees every needs-review record shows up here regardless of how
      // many total records the tenant has - the previous "just grab 50 and filter" approach
      // silently hid needs-review records past the 50th once a tenant had more records than that
      // (e.g. a single large multi-page upload).
      fetchJson<PagedResult<RecordDto>>("/api/records?status=needs_review&pageSize=250"),
      fetchJson<PagedResult<RecordDto>>("/api/records?status=pending&pageSize=1").catch(() => null)
    ])
      .then(([res, pendingRes]) => {
        const needsReview = res.items.filter((r) => {
          if (typeof r.processingStatus === "number") return r.processingStatus === NEEDS_REVIEW;
          return String(r.processingStatus).toLowerCase() === "needsreview";
        });
        setRecords(needsReview);
        setPendingCount(pendingRes?.total ?? 0);
        setSelectedId((prev) => {
          if (deepLinkPendingRef.current && prev) {
            deepLinkPendingRef.current = false;
            return prev;
          }
          if (needsReview.length === 0) {
            return null;
          }
          if (prev && needsReview.some((record) => record.id === prev)) {
            return prev;
          }
          return needsReview[0].id;
        });
        setError(null);
      })
      .catch((err) => setError(err.message ?? "Failed to load review queue"))
      .finally(() => setLoading(false));
  }, [isViewer]);

  const fetchDetail = useCallback((id: string | null) => {
    if (isViewer) {
      setDetail(null);
      setDetailError("Review queue is admin/manager only.");
      return;
    }
    if (!id) {
      setDetail(null);
      setDetailError(null);
      return;
    }

    const shouldShowLoader = !detail;
    if (shouldShowLoader) setDetailLoading(true);
    fetchJson<RecordDetailDto>(`/api/records/${id}`)
      .then((res) => {
        const hash = JSON.stringify(res);
        if (hash !== lastDetailHash.current) {
          lastDetailHash.current = hash;
          setDetail(res);
        }
        setDetailError(null);
      })
      .catch((err) => setDetailError(err.message ?? "Failed to load record"))
      .finally(() => {
        if (shouldShowLoader) setDetailLoading(false);
      });
  }, [isViewer, detail]);

  useEffect(() => {
    load();
    // Refresh queue less frequently to reduce flicker.
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  // Keep the selected detail fresh while the item sits in the queue
  useEffect(() => {
    if (!selectedId) return;
    const interval = setInterval(() => fetchDetail(selectedId), 12000);
    return () => clearInterval(interval);
  }, [fetchDetail, selectedId]);

  useEffect(() => {
    fetchDetail(selectedId);
  }, [fetchDetail, selectedId]);

  const refreshDetail = useCallback(() => {
    load();
    if (selectedId) {
      fetchDetail(selectedId);
    }
  }, [fetchDetail, load, selectedId]);

  const handleDeleted = useCallback(() => {
    setDetail(null);
    setSelectedId(null);
    load();
  }, [load]);

  const selectedRecord =
    detail?.record ?? (records.find((record) => record.id === selectedId) ?? null);

  const toggleQueueSort = (field: QueueSortField) => {
    setQueueSortDir((prevDir) => (queueSortField === field ? (prevDir === "asc" ? "desc" : "asc") : "asc"));
    setQueueSortField(field);
  };

  const queueSortArrow = (field: QueueSortField) =>
    queueSortField === field ? (queueSortDir === "asc" ? " ▲" : " ▼") : "";

  const visibleRecords = useMemo(() => {
    const term = queueSearch.trim().toLowerCase();
    const filtered = term
      ? records.filter(
          (r) =>
            (r.staffName ?? "").toLowerCase().includes(term) || (r.courseName ?? "").toLowerCase().includes(term)
        )
      : records;

    const dir = queueSortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (queueSortField) {
        case "staffName":
          return dir * (a.staffName ?? "").localeCompare(b.staffName ?? "");
        case "courseName":
          return dir * (a.courseName ?? "").localeCompare(b.courseName ?? "");
        case "issueDate":
          return dir * String(a.issueDate ?? "").localeCompare(String(b.issueDate ?? ""));
        case "expiryDate":
          return dir * String(a.expiryDate ?? "").localeCompare(String(b.expiryDate ?? ""));
        case "confidence": {
          const av = a.extractionConfidence ?? a.confidence ?? -1;
          const bv = b.extractionConfidence ?? b.confidence ?? -1;
          return dir * (av - bv);
        }
        default:
          return 0;
      }
    });
  }, [records, queueSearch, queueSortField, queueSortDir]);

  if (isViewer) {
    return (
      <div className="cw-card space-y-2 p-6">
        <h1 className="text-lg font-semibold text-slate-900">Review</h1>
        <p className="text-sm text-slate-600">Review queue is available to managers and admins.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Review</h1>
          <p className="text-sm text-slate-600">
            Items flagged as <span className="font-semibold">Needs Review</span>. Edit fields, view the source, and
            approve once the data looks right.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          Failed to load queue: {error}
        </div>
      )}

      {pendingCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
          </span>
          <span>
            <span className="font-semibold">
              {pendingCount} document{pendingCount === 1 ? "" : "s"} still processing…
            </span>{" "}
            They&apos;ll appear here automatically once extraction finishes - no need to re-upload or refresh.
          </span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="min-h-[320px] rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Needs review</p>
              <h2 className="text-base font-semibold text-slate-900">Review queue</h2>
            </div>
            <p className="text-xs text-slate-500">
              {queueSearch.trim() ? `${visibleRecords.length} of ${records.length}` : records.length} items
            </p>
          </div>

          {records.length > 0 && (
            <input
              type="search"
              value={queueSearch}
              onChange={(e) => setQueueSearch(e.target.value)}
              placeholder="Search by staff name or requirement type..."
              className="mb-3 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          )}

          {loading && records.length === 0 ? (
            <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
              Loading review items...
            </div>
          ) : records.length === 0 ? (
            <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">
              No items need review right now.
            </div>
          ) : visibleRecords.length === 0 ? (
            <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">
              No review items match &ldquo;{queueSearch.trim()}&rdquo;.
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border border-slate-100">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="border-b-2 border-slate-300 px-3 py-2 text-left">
                      <button type="button" onClick={() => toggleQueueSort("staffName")} className="hover:text-slate-900">
                        Staff name{queueSortArrow("staffName")}
                      </button>
                      {" / "}
                      <button type="button" onClick={() => toggleQueueSort("courseName")} className="hover:text-slate-900">
                        Requirement type{queueSortArrow("courseName")}
                      </button>
                    </th>
                    <th className="border-b-2 border-slate-300 px-3 py-2 text-left">
                      <button type="button" onClick={() => toggleQueueSort("issueDate")} className="hover:text-slate-900">
                        Issue{queueSortArrow("issueDate")}
                      </button>
                    </th>
                    <th className="border-b-2 border-slate-300 px-3 py-2 text-left">
                      <button type="button" onClick={() => toggleQueueSort("expiryDate")} className="hover:text-slate-900">
                        Expiry{queueSortArrow("expiryDate")}
                      </button>
                    </th>
                    <th className="border-b-2 border-slate-300 px-3 py-2">
                      <button type="button" onClick={() => toggleQueueSort("confidence")} className="hover:text-slate-900">
                        Confidence{queueSortArrow("confidence")}
                      </button>
                    </th>
                    <th className="border-b-2 border-slate-300 px-3 py-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRecords.map((record) => {
                    const isActive = record.id === selectedId;
                    return (
                      <tr
                        key={record.id}
                        className={`border-t border-slate-100 text-slate-700 transition-colors hover:bg-slate-50 ${
                          isActive ? "bg-slate-100" : ""
                        }`}
                      >
                        <td className="px-3 py-2 align-top">
                          <div className="font-semibold text-slate-900">{record.staffName}</div>
                          <div className="text-xs text-slate-500">{record.courseName}</div>
                        </td>
                        <td className="px-3 py-2 align-top">{record.issueDate ?? "--"}</td>
                        <td className="px-3 py-2 align-top">{record.expiryDate ?? "--"}</td>
                        <td className="px-3 py-2 align-top">
                          {formatConfidence(record.extractionConfidence ?? record.confidence)}
                        </td>
                        <td className="px-3 py-2 align-top text-center">
                          <button
                            onClick={() => {
                              setSelectedId(record.id);
                              // Selecting a row only updates the detail panel on the right - on
                              // narrow screens that panel sits below the fold, so without this a
                              // click can look like it did nothing. Also re-scroll even when the
                              // row was already selected (querySelector's own scrollIntoView is a
                              // no-op if already in view, so this is a safe, cheap nudge either way).
                              detailSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                            }}
                            className="rounded-md bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800"
                          >
                            View review
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section ref={detailSectionRef} className="min-h-[320px] scroll-mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-amber-600">Needs review</p>
              <h2 className="text-base font-semibold text-slate-900">
                {selectedRecord?.courseName ?? "Select a record"}
              </h2>
              <p className="text-sm text-slate-600">{selectedRecord?.staffName ?? "Expand the queue to continue"}</p>
            </div>
            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
              {selectedRecord ? statusLabel(selectedRecord.processingStatus ?? NEEDS_REVIEW) : "Pending"}
            </span>
          </div>

          <DocumentPreviewPanel document={detail?.document} loading={detailLoading} />

          {detailError && !detailLoading && (
            <p className="mt-3 text-xs text-rose-600">Failed to load record: {detailError}</p>
          )}

          {detailLoading && (
            <div className="mt-3 rounded-md border border-slate-100 bg-slate-50 p-3 text-sm text-slate-600">
              Loading record details...
            </div>
          )}

          {!detailLoading && detail && (
            <div className="mt-4">
              <ReviewCard
                key={detail.record.id}
                record={detail.record}
                requirementTypeNames={requirementTypeNames}
                onUpdated={refreshDetail}
                onDeleted={handleDeleted}
              />
            </div>
          )}

          {!detailLoading && !detail && !detailError && selectedId && (
            <div className="mt-3 rounded-md border border-slate-100 bg-slate-50 p-3 text-sm text-slate-600">
              Record detail unavailable.
            </div>
          )}

          {!detailLoading && !selectedId && (
            <div className="mt-3 rounded-md border border-slate-100 bg-slate-50 p-3 text-sm text-slate-600">
              Select a record from the queue to review.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ReviewCard({
  record,
  requirementTypeNames,
  onUpdated,
  onDeleted
}: {
  record: RecordDto;
  requirementTypeNames: string[];
  onUpdated: () => void;
  onDeleted: () => void;
}) {
  const [staffName, setStaffName] = useState(record.staffName ?? "");
  const [courseName, setCourseName] = useState(record.courseName ?? "");
  const [issuer, setIssuer] = useState(record.issuer ?? "");
  const [issueDate, setIssueDate] = useState(normalizeDate(record.issueDate));
  const [expiryDate, setExpiryDate] = useState(normalizeDate(record.expiryDate));
  const [reviewNotes, setReviewNotes] = useState(record.reviewNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Surfaces the tenant's closest-named existing requirement (e.g. "Moving & Handling" already in
  // the catalog vs. a document reading "Moving and Handling for Children and Adults") so a reviewer
  // can reuse it instead of accidentally creating a near-duplicate requirement type.
  const closestRequirementMatch = useMemo(
    () => findClosestRequirement(courseName, requirementTypeNames),
    [courseName, requirementTypeNames]
  );
  const trimmedCourseName = courseName.trim();
  // Only enforce "must be a real catalog entry" once the catalog has actually loaded - for a
  // manager (the requirement-types endpoint is admin-only, see the fetch above) this list is
  // always empty, and we don't want to block their approvals over a check we can't actually run.
  const isKnownRequirement = useMemo(
    () =>
      requirementTypeNames.length === 0 ||
      requirementTypeNames.some((name) => name.trim().toLowerCase() === trimmedCourseName.toLowerCase()),
    [requirementTypeNames, trimmedCourseName]
  );
  // Once the reviewer fixes the requirement type, the stale validation error shouldn't just sit
  // there until they notice and dismiss it by hand - clear it the moment it's no longer accurate.
  // Guarded to only clear errors this component itself raised, so an unrelated save/delete failure
  // never gets silently wiped out by an edit to an unrelated field.
  useEffect(() => {
    if (error && trimmedCourseName && isKnownRequirement && error.includes("requirement list yet")) {
      setError(null);
    }
  }, [trimmedCourseName, isKnownRequirement, error]);
  // Keep form in sync when a fresh extraction/refresh brings new data
  useEffect(() => {
    setStaffName(record.staffName ?? "");
    setCourseName(record.courseName ?? "");
    setIssuer(record.issuer ?? "");
    setIssueDate(normalizeDate(record.issueDate));
    setExpiryDate(normalizeDate(record.expiryDate));
    setReviewNotes(record.reviewNotes ?? "");
  }, [record]);

  const confidenceValue = record.extractionConfidence ?? record.confidence ?? null;
  const confidenceText = useMemo(() => {
    if (record.extractionConfidence != null) return `${(record.extractionConfidence * 100).toFixed(0)}% AI`;
    if (record.confidence != null) return `${(record.confidence * 100).toFixed(0)}%`;
    return "n/a";
  }, [record.confidence, record.extractionConfidence]);
  const confidenceColorClass =
    confidenceValue == null
      ? "text-slate-500"
      : confidenceValue >= 0.8
        ? "text-emerald-600"
        : confidenceValue >= 0.5
          ? "text-amber-600"
          : "text-rose-600";

  const patch = async (processingStatus?: number) => {
    if (!trimmedCourseName) {
      setError("Requirement type is required.");
      return;
    }
    if (!isKnownRequirement) {
      setError(
        `"${trimmedCourseName}" isn't in your requirement list yet. Add it to Requirements, or pick an existing one, before saving.`
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await patchJson<RecordDto, Record<string, unknown>>(`/api/records/${record.id}`, {
        staffName: staffName || undefined,
        courseName: courseName || undefined,
        issuer: issuer || undefined,
        issueDate: issueDate ? issueDate : null,
        expiryDate: expiryDate ? expiryDate : null,
        reviewNotes,
        processingStatus
      });
      onUpdated();
    } catch (err: any) {
      setError(err?.message ?? "Failed to update record");
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    setConfirmingDelete(true);
  };

  const confirmDelete = async () => {
    setSaving(true);
    setError(null);
    try {
      await deleteJson(`/api/records/${record.id}`);
      onDeleted();
    } catch (err: any) {
      setError(err?.message ?? "Failed to delete record");
    } finally {
      setSaving(false);
      setConfirmingDelete(false);
    }
  };

  const cancelDelete = () => {
    setConfirmingDelete(false);
  };


  return (
    <div className="flex flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <p className="text-xs uppercase text-amber-600">Needs Review</p>
          <h2 className="text-base font-semibold text-slate-900">{courseName || record.courseName}</h2>
          <p className="text-sm text-slate-700">{staffName || record.staffName}</p>
          <p className="mt-1 text-xs text-slate-500">
            AI confidence: <span className={`font-bold ${confidenceColorClass}`}>{confidenceText}</span>
          </p>
          {record.reviewReason && (
            <p className="font-medium text-xs text-rose-600">Reason: {formatReviewReason(record.reviewReason)}</p>
          )}
        </div>
        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">Review</span>
      </div>

      <div className="space-y-2">
        <Field label="Staff name" value={staffName} onChange={setStaffName} />
        <RequirementTypeCombobox value={courseName} onChange={setCourseName} suggestions={requirementTypeNames} />
        {trimmedCourseName && !isKnownRequirement && (
          <div className="-mt-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
            <p>
              &ldquo;{trimmedCourseName}&rdquo; isn&apos;t in your requirement list yet.
              {closestRequirementMatch && (
                <>
                  {" "}
                  Did you mean{" "}
                  <button
                    type="button"
                    onClick={() => setCourseName(closestRequirementMatch.name)}
                    className="font-semibold underline hover:text-amber-900"
                  >
                    {closestRequirementMatch.name}
                  </button>
                  ?
                </>
              )}
            </p>
            <a
              href={`/requirements?name=${encodeURIComponent(trimmedCourseName)}`}
              className="mt-1 inline-block font-semibold text-blue-700 underline hover:text-blue-800"
            >
              + Add &ldquo;{trimmedCourseName}&rdquo; to Requirements
            </a>
          </div>
        )}
        <Field label="Issuer" value={issuer} onChange={setIssuer} />
        <Field label="Issue date" value={issueDate} onChange={setIssueDate} placeholder="YYYY-MM-DD" />
        <Field label="Expiry date" value={expiryDate} onChange={setExpiryDate} placeholder="YYYY-MM-DD" />
        <div>
          <label className="block text-xs font-semibold text-slate-600">Review notes</label>
          <textarea
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
            rows={2}
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => setError(null)}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-600">
                  <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" strokeLinejoin="round" />
                </svg>
                <h3 className="text-sm font-semibold text-slate-900">Can&apos;t save yet</h3>
              </div>
              <button
                type="button"
                onClick={() => setError(null)}
                aria-label="Close"
                className="flex-shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-700">{error}</p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setError(null)}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => patch(1 /* Ok */)}
          disabled={saving}
          className="rounded-md bg-emerald-600 px-3 py-1 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Approve"}
        </button>
        <button
          onClick={() => patch(NEEDS_REVIEW)}
          disabled={saving}
          title="Saves your edits without approving - it stays right here in this Needs Review queue for later."
          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-60"
        >
          Save & keep in queue
        </button>
        <button
          onClick={remove}
          disabled={saving}
          className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
        >
          Reject & delete
        </button>
        <p className="text-xs text-slate-500">Created at {formatDate(record.createdAt)}</p>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        &ldquo;Save & keep in queue&rdquo; saves your edits without approving - the record stays in this same Needs
        Review queue above so you can come back to it later.
      </p>

      {confirmingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50">
          <div className="w-[360px] rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
            <h3 className="text-base font-semibold text-slate-900">Delete record?</h3>
            <p className="mt-2 text-sm text-slate-600">
              This will permanently delete the record and its document. This cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={cancelDelete}
                className="rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={saving}
                className="rounded-md bg-rose-600 px-3 py-1 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {saving ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.25;

function DocumentPreviewPanel({ document, loading }: { document?: DocumentDto | null; loading: boolean }) {
  // All hooks live above any early return (loading/no-document below) - React requires hooks to
  // run in the same order on every render. They used to sit after those early returns, which
  // meant that on whichever render happened to hit "loading" or "no document" - e.g. a background
  // detail refresh - React lost track of this component's hook slots entirely and silently reset
  // them, including "enlarged", which is exactly what made an already-open preview popup vanish
  // on its own with no user action.
  const [enlarged, setEnlarged] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  // Snapshot of the document the popup was opened for. Rendering the modal from this instead of
  // the live `document` prop means it keeps showing what the user opened even if the underlying
  // record changes or drops out from under them in the background (e.g. someone else actions the
  // same queue item) while they're still looking at it - it only closes when they close it.
  const [modalDoc, setModalDoc] = useState<DocumentDto | null>(null);

  // Reload the persisted rotation whenever the document actually changes (not just on first
  // mount - a useState initializer only runs once, so it can't react to a later document swap).
  useEffect(() => {
    if (!document) return;
    try {
      const saved = Number(window.localStorage.getItem(`cw_doc_rotation_${document.id}`));
      setRotation([0, 90, 180, 270].includes(saved) ? saved : 0);
    } catch {
      setRotation(0);
    }
  }, [document?.id]);

  const rotate = (delta: number) => {
    if (!modalDoc) return;
    setRotation((prev) => {
      const next = ((prev + delta) % 360 + 360) % 360;
      try {
        window.localStorage.setItem(`cw_doc_rotation_${modalDoc.id}`, String(next));
      } catch {
        // Best-effort - rotation still works this session even if it can't persist.
      }
      return next;
    });
  };
  const zoomBy = (delta: number) => {
    setZoom((prev) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((prev + delta) * 100) / 100)));
  };
  const openEnlarged = () => {
    if (!document) return;
    setModalDoc(document);
    setZoom(1);
    setEnlarged(true);
  };

  // Built from `loading`/`document` only - never touches `enlarged`/`modalDoc`, so nothing about
  // the popup below is affected by whichever of these three states the panel is in right now.
  let panel: React.ReactNode;
  if (loading) {
    panel = (
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
        Loading record preview...
      </div>
    );
  } else if (!document) {
    panel = (
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
        Select a record to view the submitted document.
      </div>
    );
  } else {
    const previewUrl = `${API_BASE}/api/documents/${document.id}/file`;
    panel = (
      <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700">
        <div className="flex flex-col gap-1">
          <p className="font-semibold text-slate-900">{document.fileName}</p>
          <p className="text-xs text-slate-500">MIME: {document.mimeType}</p>
          <p className="text-xs text-slate-500">Extraction confidence: {formatConfidence(document.extractionConfidence)}</p>
        </div>
        <button
          type="button"
          onClick={openEnlarged}
          className="group relative mt-3 block h-56 w-full overflow-hidden rounded-md border border-slate-200 text-left"
          title="Click to enlarge"
        >
          <iframe src={previewUrl} title={`${document.fileName} preview`} className="h-full w-full bg-white" loading="lazy" />
          {/* Overlay to intercept the click - a plain click on the iframe itself would go to the
              embedded PDF/image viewer instead of bubbling up to this button. */}
          <span className="absolute inset-0 flex items-center justify-center bg-slate-900/0 opacity-0 transition group-hover:bg-slate-900/30 group-hover:opacity-100">
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow">Click to enlarge</span>
          </span>
        </button>
        <a href={previewUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-semibold text-slate-700">
          Open original document in new tab
        </a>
      </div>
    );
  }

  const isSideways = rotation === 90 || rotation === 270;
  const isImage = modalDoc?.mimeType?.startsWith("image/") ?? false;
  const modalPreviewUrl = modalDoc ? `${API_BASE}/api/documents/${modalDoc.id}/file` : "";
  const contentStyle: React.CSSProperties = {
    transform: `rotate(${rotation}deg) scale(${zoom})`,
    transformOrigin: "center center"
  };

  return (
    <>
      {panel}

      {/* Deliberately not gated on `document`/`loading` at all (see `panel` above) - once open,
          this only closes when the user closes it, regardless of what the panel state does. */}
      {enlarged && modalDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-6"
          onClick={() => setEnlarged(false)}
        >
          <div
            className="flex h-full w-full max-w-4xl flex-col rounded-lg bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <p className="truncate text-sm font-semibold text-slate-900">{modalDoc.fileName}</p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => zoomBy(-ZOOM_STEP)}
                  disabled={zoom <= ZOOM_MIN}
                  aria-label="Zoom out"
                  title="Zoom out"
                  className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
                >
                  <ZoomIcon out />
                </button>
                <span className="w-10 text-center text-xs font-medium text-slate-500">{Math.round(zoom * 100)}%</span>
                <button
                  onClick={() => zoomBy(ZOOM_STEP)}
                  disabled={zoom >= ZOOM_MAX}
                  aria-label="Zoom in"
                  title="Zoom in"
                  className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
                >
                  <ZoomIcon />
                </button>
                <span className="mx-1 h-5 w-px bg-slate-200" />
                <button
                  onClick={() => rotate(-90)}
                  aria-label="Rotate left"
                  title="Rotate left"
                  className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                >
                  <RotateIcon />
                </button>
                <button
                  onClick={() => rotate(90)}
                  aria-label="Rotate right"
                  title="Rotate right"
                  className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                >
                  <RotateIcon mirrored />
                </button>
                <button
                  onClick={() => setEnlarged(false)}
                  aria-label="Close preview"
                  className="ml-1 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                    <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex flex-1 items-center justify-center overflow-auto bg-slate-100 p-4">
              {isImage ? (
                // A real <img> so rotate/zoom transform the actual image pixels directly - for
                // PDFs (the common case) there's no equivalent: the iframe hands rendering off to
                // the browser's own PDF viewer, so the best we can do is transform the iframe
                // element itself (below) rather than an extra wrapping div around it, which keeps
                // the transform as close to "the content" as this approach allows.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={modalPreviewUrl}
                  alt={modalDoc.fileName}
                  className="max-h-full max-w-full object-contain transition-transform duration-200"
                  style={contentStyle}
                />
              ) : (
                <iframe
                  src={modalPreviewUrl}
                  title={`${modalDoc.fileName} preview`}
                  className="shrink-0 border-0 bg-white shadow transition-transform duration-200"
                  style={{
                    ...contentStyle,
                    width: isSideways ? "70vh" : "70vw",
                    height: isSideways ? "70vw" : "70vh"
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// A rotate-right icon is this same rotate-left arrow mirrored horizontally (mirrored prop) -
// avoids drawing two near-identical curved-arrow paths by hand.
function RotateIcon({ mirrored }: { mirrored?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={`h-4 w-4 ${mirrored ? "-scale-x-100" : ""}`}
    >
      <path d="M4 9a8 8 0 1 1 1.5 8.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 4v5h5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ZoomIcon({ out }: { out?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m20 20-4.35-4.35" strokeLinecap="round" />
      {out ? <path d="M7.5 10.5h6" strokeLinecap="round" /> : <path d="M10.5 7.5v6M7.5 10.5h6" strokeLinecap="round" />}
    </svg>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600">{label}</label>
      <input
        className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

// A native <input list> + <datalist> combo used to power this field, but browsers only show
// matching suggestions - once the value is something like an OCR'd course name that doesn't match
// anything in the catalog, the dropdown shows nothing at all until the reviewer clears the field
// by hand. This custom combobox always lets the dropdown arrow open the full current list
// regardless of what's already typed, with the same field doubling as a live search box once open.
function RequirementTypeCombobox({
  value,
  onChange,
  suggestions
}: {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? suggestions.filter((name) => name.toLowerCase().includes(term)) : suggestions;
  }, [query, suggestions]);

  const openWithFullList = () => {
    setQuery("");
    setOpen(true);
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs font-semibold text-slate-600">Requirement type</label>
      <div className="mt-1 flex items-stretch">
        <input
          className="w-full rounded-l-md border border-r-0 border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={openWithFullList}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Type, or use the list on the right"
        />
        <button
          type="button"
          onClick={() => (open ? setOpen(false) : openWithFullList())}
          aria-label="Show requirement type list"
          className="flex items-center justify-center rounded-r-md border border-slate-300 bg-slate-50 px-2 hover:bg-slate-100"
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className={`h-4 w-4 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path d="M5.25 7.5l4.75 5 4.75-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {open && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {suggestions.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-500">No requirement types set up yet.</p>
          ) : filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-500">No matches - this will be a new requirement type.</p>
          ) : (
            filtered.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  onChange(name);
                  setQuery(name);
                  setOpen(false);
                }}
                className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 ${
                  name.toLowerCase() === value.trim().toLowerCase()
                    ? "bg-slate-50 font-semibold text-slate-900"
                    : "text-slate-700"
                }`}
              >
                {name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

// Fraction of the smaller token set shared with the other - rewards a short canonical name (e.g.
// "moving and handling") that's fully contained in a longer, more specific extracted phrase (e.g.
// "moving and handling for children and adults") with a perfect 1.0 score.
function similarityScore(a: string, b: string): number {
  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let shared = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) shared++;
  }
  return shared / Math.min(tokensA.size, tokensB.size);
}

function findClosestRequirement(
  value: string,
  candidates: string[]
): { name: string; score: number } | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  let best: string | null = null;
  let bestScore = 0;
  for (const candidate of candidates) {
    if (candidate.trim().toLowerCase() === trimmed.toLowerCase()) {
      // Already an exact match to something in the catalog - nothing to suggest.
      return null;
    }
    const score = similarityScore(trimmed, candidate);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best && bestScore >= 0.5 ? { name: best, score: bestScore } : null;
}

function normalizeDate(value?: string | null): string {
  if (!value) return "";
  // Accept either DateOnly ("2025-10-08") or DateTime strings.
  if (value.length >= 10) return value.substring(0, 10);
  return value;
}

function formatDate(value?: string | null): string {
  if (!value) return "--";
  const dt = new Date(value);
  return isNaN(dt.getTime()) ? value : dt.toLocaleString();
}

function formatConfidence(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return `${Math.round(value * 100)}%`;
}

const REVIEW_REASON_LABELS: Record<string, string> = {
  "needs_review:unknown_requirement": "Requirement type could not be determined",
  "needs_review:duplicate_record": "Possible duplicate of an existing record"
};

// reviewReason can carry multiple ";"-joined internal hint codes (e.g. "needs_review:unknown_requirement");
// translate the ones we know into plain language rather than showing raw codes to the reviewer.
function formatReviewReason(reason: string): string {
  return reason
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => REVIEW_REASON_LABELS[part] ?? part.replace(/^needs_review:/, "").replace(/_/g, " "))
    .join(", ");
}

function statusLabel(status: number | string | undefined): string {
  const map: Record<string, string> = {
    "0": "pending",
    "1": "ok",
    "2": "needs review",
    "3": "failed"
  };
  if (typeof status === "number") {
    return map[String(status)] ?? String(status);
  }
  const lower = status?.toLowerCase() ?? "";
  return map[lower] ?? lower;
}
