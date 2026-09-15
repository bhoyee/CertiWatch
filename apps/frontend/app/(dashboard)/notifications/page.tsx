"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchJson, postVoid } from "../../../lib/api";

type NotificationDto = {
  id: string;
  recordId?: string | null;
  ticketId?: string | null;
  type: "expiring" | "expired" | "needs_review" | "support_reply" | "support_status" | string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
};

type FeedPage = { items: NotificationDto[]; total: number; page: number; pageSize: number };

const isSupportType = (type: string) => type === "support_reply" || type === "support_status";

function dotColor(type: string) {
  if (type === "expired") return "bg-rose-500";
  if (isSupportType(type)) return "bg-indigo-500";
  return "bg-amber-500";
}

function hrefFor(n: NotificationDto): string {
  if (isSupportType(n.type) && n.ticketId) return `/support?ticket=${n.ticketId}`;
  if (n.type === "needs_review" && n.recordId) return `/review?recordId=${n.recordId}`;
  if (n.recordId) return "/records";
  return "/analytics";
}

export default function NotificationsPage() {
  const [data, setData] = useState<FeedPage | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 25;

  const load = async (targetPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchJson<FeedPage>(`/api/notifications/feed?page=${targetPage}&pageSize=${pageSize}`);
      setData(res);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const markRead = async (id: string) => {
    setData((prev) => (prev ? { ...prev, items: prev.items.map((n) => (n.id === id ? { ...n, isRead: true } : n)) } : prev));
    try {
      await postVoid(`/api/notifications/${id}/read`);
    } catch {
      // best-effort, matches the bell's own handling
    }
  };

  const markAllRead = async () => {
    setData((prev) => (prev ? { ...prev, items: prev.items.map((n) => ({ ...n, isRead: true })) } : prev));
    try {
      await postVoid("/api/notifications/read-all");
    } catch {
      // best-effort
    }
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const hasUnread = data?.items.some((n) => !n.isRead) ?? false;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-600">Every update, newest first - expiries, review flags, and support activity.</p>
        </div>
        {hasUnread && (
          <button
            onClick={markAllRead}
            className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
          >
            Mark all read
          </button>
        )}
      </div>

      {error && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">Loading…</p>
        ) : !data || data.items.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">No notifications yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {data.items.map((n) => (
              <Link
                key={n.id}
                href={hrefFor(n)}
                onClick={() => {
                  if (!n.isRead) void markRead(n.id);
                }}
                className={`flex gap-3 px-5 py-4 text-sm transition hover:bg-slate-50 ${n.isRead ? "" : "bg-indigo-50/40"}`}
              >
                <span className={`mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full ${dotColor(n.type)} ${n.isRead ? "opacity-30" : ""}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-slate-900">{n.title}</p>
                    <span className="flex-shrink-0 text-xs text-slate-400">{formatDate(n.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{n.body}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {data && data.total > 0 && (
        <div className="flex flex-col gap-2 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Showing {(data.page - 1) * data.pageSize + 1}-{Math.min(data.total, data.page * data.pageSize)} of {data.total}
          </span>
          <div className="flex items-center gap-2">
            <button
              className="rounded-md border border-slate-200 px-3 py-1 font-medium text-slate-700 disabled:opacity-50"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            <span>
              Page {data.page} / {totalPages}
            </span>
            <button
              className="rounded-md border border-slate-200 px-3 py-1 font-medium text-slate-700 disabled:opacity-50"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
