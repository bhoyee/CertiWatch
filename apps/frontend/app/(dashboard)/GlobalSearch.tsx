"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "../../lib/api";
import { navItems } from "./navItems";

type RecordHit = {
  id: string;
  staffName: string;
  courseName: string;
  expiryDate: string | null;
};

type PagedResult<T> = { items: T[]; total: number };

export function GlobalSearch({
  isBlocked,
  role,
  isSuper
}: {
  isBlocked: boolean;
  role: string | null;
  isSuper?: boolean;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [records, setRecords] = useState<RecordHit[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  const roleLower = role?.toLowerCase();
  const isViewer = roleLower === "viewer";
  const isSuperRole = isSuper || roleLower === "superadmin";

  const pages = navItems.filter((item) => {
    if (isSuperRole) return item.superOnly || item.href === "/profile" || item.href === "/logout";
    if (isViewer && item.viewerHidden) return false;
    if (roleLower === "manager" && item.managerHidden) return false;
    if (item.superOnly && roleLower !== "superadmin") return false;
    return true;
  });

  const trimmed = query.trim();
  const matchedPages = trimmed
    ? pages.filter((p) => p.label.toLowerCase().includes(trimmed.toLowerCase())).slice(0, 6)
    : [];

  useEffect(() => {
    if (!trimmed || isSuperRole) {
      setRecords([]);
      return;
    }
    let active = true;
    setLoadingRecords(true);
    const id = setTimeout(() => {
      const params = new URLSearchParams({ filter: trimmed, page: "1", pageSize: "5" });
      fetchJson<PagedResult<RecordHit>>(`/api/records?${params.toString()}`)
        .then((res) => {
          if (active) setRecords(res.items ?? []);
        })
        .catch(() => {
          if (active) setRecords([]);
        })
        .finally(() => {
          if (active) setLoadingRecords(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(id);
    };
  }, [trimmed, isSuperRole]);

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

  const goToRecord = (hit: RecordHit) => {
    router.push(`/records?q=${encodeURIComponent(hit.staffName)}`);
    setOpen(false);
    setQuery("");
  };

  const hasResults = matchedPages.length > 0 || records.length > 0;

  return (
    <div className="relative w-full md:w-80" ref={containerRef}>
      <div className="flex w-full items-center gap-2 rounded-full border-2 border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-inner transition focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-100">
        <svg className="h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        <input
          className="w-full border-0 bg-transparent text-sm focus:outline-none"
          placeholder="Search anything — pages, staff, requirement..."
          aria-label="Search"
          disabled={isBlocked}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => query.trim() && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
      </div>

      {open && trimmed && (
        <div className="absolute left-0 right-0 z-50 mt-2 max-h-96 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-lg">
          {!hasResults && !loadingRecords ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">No matches for "{trimmed}".</p>
          ) : (
            <>
              {matchedPages.length > 0 && (
                <div>
                  <div className="bg-slate-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Pages
                  </div>
                  {matchedPages.map((p) => (
                    <Link
                      key={p.href}
                      href={p.href}
                      onClick={() => {
                        setOpen(false);
                        setQuery("");
                      }}
                      className="block px-4 py-2 text-sm text-slate-800 hover:bg-slate-50"
                    >
                      {p.label}
                    </Link>
                  ))}
                </div>
              )}
              {!isSuperRole && (
                <div>
                  <div className="bg-slate-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Records
                  </div>
                  {loadingRecords ? (
                    <p className="px-4 py-3 text-sm text-slate-500">Searching…</p>
                  ) : records.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-slate-500">No matching records.</p>
                  ) : (
                    records.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => goToRecord(r)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                      >
                        <span>
                          <span className="font-medium">{r.staffName}</span>
                          <span className="text-slate-500"> · {r.courseName}</span>
                        </span>
                        {r.expiryDate && <span className="shrink-0 text-xs text-slate-400">{r.expiryDate}</span>}
                      </button>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
