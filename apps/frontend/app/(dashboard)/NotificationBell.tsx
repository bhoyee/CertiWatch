"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { fetchJson, postVoid } from "../../lib/api";

type NotificationDto = {
  id: string;
  recordId?: string | null;
  type: "expiring" | "expired" | string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
};

// Polls a plain count first (cheap, every request) and only fetches the full feed lazily when
// the panel is actually opened - the badge needs to stay current at a glance, but nobody needs
// the last 20 notification bodies re-fetched every 15s if they never open the bell.
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const poll = () => {
      fetchJson<{ count: number }>("/api/notifications/unread-count")
        .then((res) => {
          if (active) setCount(res.count ?? 0);
        })
        .catch(() => {
          if (active) setCount(0);
        });
    };
    poll();
    const id = setInterval(poll, 15000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const loadFeed = async () => {
    setLoadingFeed(true);
    try {
      const res = await fetchJson<NotificationDto[]>("/api/notifications/feed?take=20");
      setItems(res);
    } catch {
      setItems([]);
    } finally {
      setLoadingFeed(false);
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) void loadFeed();
  };

  const markRead = async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setCount((c) => Math.max(0, c - 1));
    try {
      await postVoid(`/api/notifications/${id}/read`);
    } catch {
      // Best-effort - a stale badge count self-corrects on the next 15s poll either way.
    }
  };

  const markAllRead = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setCount(0);
    try {
      await postVoid("/api/notifications/read-all");
    } catch {
      // same as above
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={toggle}
        aria-label="Notifications"
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5">
          <path d="M6 8a6 6 0 1 1 12 0c0 4 1.5 5.5 2 6.5H4c.5-1 2-2.5 2-6.5Z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9.5 18.5a2.5 2.5 0 0 0 5 0" strokeLinecap="round" />
        </svg>
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-2xl border border-slate-200 bg-white shadow-lg sm:w-96">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            {items.some((n) => !n.isRead) && (
              <button onClick={markAllRead} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {loadingFeed ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">No notifications yet.</p>
            ) : (
              items.map((n) => (
                <Link
                  key={n.id}
                  href={n.recordId ? "/records" : "/analytics"}
                  onClick={() => {
                    if (!n.isRead) void markRead(n.id);
                    setOpen(false);
                  }}
                  className={`flex gap-3 border-b border-slate-50 px-4 py-3 text-sm transition hover:bg-slate-50 ${
                    n.isRead ? "" : "bg-indigo-50/40"
                  }`}
                >
                  <span
                    className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${
                      n.type === "expired" ? "bg-rose-500" : "bg-amber-500"
                    } ${n.isRead ? "opacity-0" : ""}`}
                  />
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{n.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{n.body}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{timeAgo(n.createdAt)}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
