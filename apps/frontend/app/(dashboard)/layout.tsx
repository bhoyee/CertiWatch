"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { fetchJson } from "../../lib/api";
import { PlanBanner } from "./PlanBanner";

const navItems = [
  { href: "/analytics", label: "Analytics" },
  { href: "/records", label: "Records" },
  { href: "/review", label: "Review" },
  { href: "/rules", label: "Rules" },
  { href: "/devices", label: "Devices" },
  { href: "/uploads", label: "Uploads" },
  { href: "/sources", label: "Sources" },
  { href: "/admin/invite", label: "Invite" },
  { href: "/logout", label: "Logout" }
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100">
      <div className="flex min-h-screen">
        <aside className="hidden w-68 flex-shrink-0 border-r border-slate-200 bg-white/90 px-4 py-6 backdrop-blur md:flex md:flex-col md:gap-6">
          <Logo />
          <NavLinks />
        </aside>
        <main className="flex-1 px-4 py-6 md:px-10">
          <div className="mb-4 flex items-center justify-between md:hidden">
            <Logo />
            <button
              onClick={() => setOpen((v) => !v)}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm"
            >
              Menu
            </button>
          </div>
          {open && (
            <div className="mb-4 rounded-lg border border-slate-200 bg-white p-3 shadow-sm md:hidden">
              <NavLinks onClick={() => setOpen(false)} />
            </div>
          )}
          <TopBar />
          <PlanBanner />
          <div className="mt-4 space-y-4">{children}</div>
        </main>
      </div>
    </div>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-3 px-1">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 text-white font-semibold shadow-sm">
        CW
      </div>
      <div>
        <Link href="/analytics" className="text-lg font-semibold text-slate-900">
          CertiWatch
        </Link>
        <p className="text-xs text-slate-500">Compliance dashboard</p>
      </div>
    </div>
  );
}

function TopBar() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-2">
        <div className="hidden text-xs font-semibold uppercase tracking-wide text-slate-500 md:block">Dashboard</div>
        <div className="h-5 w-px bg-slate-200 md:block" />
        <div className="text-sm text-slate-600">Stay on top of certificates and review queue</div>
      </div>
      <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-center md:gap-3 md:justify-end">
        <div className="flex w-full items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-inner md:w-80">
          <span className="text-slate-400">🔍</span>
          <input
            className="w-full border-0 bg-transparent text-sm focus:outline-none"
            placeholder="Search staff, course, issuer..."
            aria-label="Search"
          />
        </div>
        <Link
          href="/uploads"
          className="flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95"
        >
          New upload
        </Link>
        <Link
          href="/review"
          className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:border-slate-300"
        >
          Review queue
        </Link>
      </div>
    </div>
  );
}

function NavLinks({ onClick }: { onClick?: () => void } = {}) {
  const [reviewCount, setReviewCount] = useState<number>(0);
  const pathname = usePathname();

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetchJson<{ count: number }>("/api/records/review-count");
        if (active) setReviewCount(res.count ?? 0);
      } catch {
        if (active) setReviewCount(0);
      }
    };
    load();
    const id = setInterval(load, 30000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  return (
    <nav className="space-y-1">
      {navItems.map((item) => {
        const showBadge = item.href === "/review" && reviewCount > 0;
        const active = pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClick}
            className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold transition ${
              active
                ? "bg-gradient-to-r from-indigo-50 to-blue-50 text-indigo-700 border border-indigo-100"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            <span>{item.label}</span>
            {showBadge && (
              <span className="ml-2 rounded-full bg-rose-600 px-2 py-0.5 text-xs font-semibold text-white">
                {reviewCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
