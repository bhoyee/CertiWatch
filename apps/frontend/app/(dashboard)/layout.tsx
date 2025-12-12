"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
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
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 flex-shrink-0 border-r border-slate-200 bg-white p-4 md:flex md:flex-col">
          <Logo />
          <NavLinks />
        </aside>
        <main className="flex-1 px-4 py-6 md:px-8">
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
          <PlanBanner />
          {children}
        </main>
      </div>
    </div>
  );
}

function Logo() {
  return (
    <div className="mb-6 px-2">
      <Link href="/analytics" className="text-lg font-bold text-slate-900">
        CertiWatch
      </Link>
    </div>
  );
}

function NavLinks({ onClick }: { onClick?: () => void } = {}) {
  const [reviewCount, setReviewCount] = useState<number>(0);

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
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClick}
            className="flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
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
