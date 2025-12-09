"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchJson, patchJson } from "../../../lib/api";

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

export default function ReviewQueuePage() {
  const [records, setRecords] = useState<RecordDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RecordDetailDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchJson<PagedResult<RecordDto>>("/api/records?take=50")
      .then((res) => {
        const needsReview = res.items.filter((r) => {
          if (typeof r.processingStatus === "number") return r.processingStatus === NEEDS_REVIEW;
          return String(r.processingStatus).toLowerCase() === "needsreview";
        });
        setRecords(needsReview);
        setSelectedId((prev) => {
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
  }, []);

  const fetchDetail = useCallback((id: string | null) => {
    if (!id) {
      setDetail(null);
      setDetailError(null);
      return;
    }

    setDetailLoading(true);
    fetchJson<RecordDetailDto>(`/api/records/${id}`)
      .then((res) => {
        setDetail(res);
        setDetailError(null);
      })
      .catch((err) => setDetailError(err.message ?? "Failed to load record"))
      .finally(() => setDetailLoading(false));
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    fetchDetail(selectedId);
  }, [fetchDetail, selectedId]);

  const refreshDetail = useCallback(() => {
    load();
    if (selectedId) {
      fetchDetail(selectedId);
    }
  }, [fetchDetail, load, selectedId]);

  const selectedRecord =
    detail?.record ?? (records.find((record) => record.id === selectedId) ?? null);

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

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="min-h-[320px] rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Needs review</p>
              <h2 className="text-base font-semibold text-slate-900">Review queue</h2>
            </div>
            <p className="text-xs text-slate-500">{records.length} items</p>
          </div>

          {loading && records.length === 0 ? (
            <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
              Loading review items...
            </div>
          ) : records.length === 0 ? (
            <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">
              No items need review right now.
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border border-slate-100">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Staff / Course</th>
                    <th className="px-3 py-2 text-left">Issue</th>
                    <th className="px-3 py-2 text-left">Expiry</th>
                    <th className="px-3 py-2">Confidence</th>
                    <th className="px-3 py-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => {
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
                            onClick={() => setSelectedId(record.id)}
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

        <section className="min-h-[320px] rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
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
              <ReviewCard key={detail.record.id} record={detail.record} onUpdated={refreshDetail} />
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

function ReviewCard({ record, onUpdated }: { record: RecordDto; onUpdated: () => void }) {
  const [staffName, setStaffName] = useState(record.staffName ?? "");
  const [courseName, setCourseName] = useState(record.courseName ?? "");
  const [issuer, setIssuer] = useState(record.issuer ?? "");
  const [issueDate, setIssueDate] = useState(normalizeDate(record.issueDate));
  const [expiryDate, setExpiryDate] = useState(normalizeDate(record.expiryDate));
  const [reviewNotes, setReviewNotes] = useState(record.reviewNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confidenceText = useMemo(() => {
    if (record.extractionConfidence != null) return `${(record.extractionConfidence * 100).toFixed(0)}% AI`;
    if (record.confidence != null) return `${(record.confidence * 100).toFixed(0)}%`;
    return "n/a";
  }, [record.confidence, record.extractionConfidence]);

  const patch = async (processingStatus?: number) => {
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

  return (
    <div className="flex flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <p className="text-xs uppercase text-amber-600">Needs Review</p>
          <h2 className="text-base font-semibold text-slate-900">{courseName || record.courseName}</h2>
          <p className="text-sm text-slate-700">{staffName || record.staffName}</p>
          <p className="text-xs text-slate-500 mt-1">AI confidence: {confidenceText}</p>
          {record.reviewReason && <p className="text-xs text-slate-500">Reason: {record.reviewReason}</p>}
        </div>
        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">Review</span>
      </div>

      <div className="space-y-2">
        <Field label="Staff name" value={staffName} onChange={setStaffName} />
        <Field label="Course" value={courseName} onChange={setCourseName} />
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

      {record.fields && Object.keys(record.fields).length > 0 && (
        <div className="mt-3 rounded-md border border-slate-100 bg-slate-50 p-2">
          <p className="mb-1 text-xs font-semibold text-slate-600">Extracted fields</p>
          <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-slate-700">
            {Object.entries(record.fields).map(([k, v]) => (
              <div key={k} className="flex">
                <dt className="w-20 font-semibold capitalize">{k}</dt>
                <dd className="flex-1">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}

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
          className="rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          Save & keep in queue
        </button>
        <p className="text-xs text-slate-500">Created at {formatDate(record.createdAt)}</p>
      </div>
    </div>
  );
}

function DocumentPreviewPanel({ document, loading }: { document?: DocumentDto | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
        Loading record preview...
      </div>
    );
  }

  if (!document) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
        Select a record to view the submitted document.
      </div>
    );
  }

  const previewUrl = `${API_BASE}/api/documents/${document.id}/file`;
  const iframeTitle = `${document.fileName} preview`;

  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700">
      <div className="flex flex-col gap-1">
        <p className="font-semibold text-slate-900">{document.fileName}</p>
        <p className="text-xs text-slate-500">MIME: {document.mimeType}</p>
        <p className="text-xs text-slate-500">Extraction confidence: {formatConfidence(document.extractionConfidence)}</p>
      </div>
      <div className="mt-3 h-56 overflow-hidden rounded-md border border-slate-200">
        <iframe
          src={previewUrl}
          title={iframeTitle}
          className="h-full w-full bg-white"
          loading="lazy"
        />
      </div>
      <a
        href={previewUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-flex text-xs font-semibold text-slate-700"
      >
        Open original document in new tab
      </a>
    </div>
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
