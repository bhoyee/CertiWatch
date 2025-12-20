"use client";

import Link from "next/link";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { fetchJson, postJson } from "../../lib/api";
import { PlanBanner } from "./PlanBanner";
import { RoleProvider } from "./RoleContext";

type TenantPlanDto = {
  tenantName: string;
  planId: string;
  planName: string;
  recordLimit: number;
  recordCount: number;
  deviceCount: number;
  sourceCount: number;
  subscriptionStatus?: string | null;
  currentPeriodEndUtc?: string | null;
};

type ProfileDto = {
  email: string;
  role: string;
  name?: string | null;
  tenantName: string;
};

const navItems = [
  { href: "/analytics", label: "Analytics", icon: "chart" },
  { href: "/records", label: "Records", icon: "table" },
  { href: "/review", label: "Review", icon: "flag", viewerHidden: true },
  { href: "/rules", label: "Rules", icon: "shield", viewerHidden: true, managerHidden: true },
  { href: "/devices", label: "Devices", icon: "cpu", viewerHidden: true, managerHidden: true },
  { href: "/uploads", label: "Uploads", icon: "cloud" },
  { href: "/sources", label: "Sources", icon: "plug", viewerHidden: true, managerHidden: true },
  { href: "/plan", label: "Manage plan", icon: "credit", viewerHidden: true, managerHidden: true },
  { href: "/profile", label: "Profile", icon: "user" },
  { href: "/admin/invite", label: "Invite", icon: "users", viewerHidden: true },
  { href: "/logout", label: "Logout", icon: "exit" }
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<TenantPlanDto | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const isViewer = role?.toLowerCase() === "viewer";
  const isManager = role?.toLowerCase() === "manager";
  const blockedByError =
    planError?.toLowerCase().includes("subscription inactive") ||
    planError?.toLowerCase().includes("payment") ||
    planError?.toLowerCase().includes("plan");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetchJson<TenantPlanDto>("/api/tenant/me");
        if (active) setPlan(res);
      } catch (err) {
        if (active) setPlanError((err as any).message ?? "Failed to load plan");
      } finally {
        if (active) setPlanLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      try {
        const res = await fetchJson<ProfileDto>("/api/profile");
        if (active) setRole(res.role);
      } catch {
        if (active) setRole(null);
      } finally {
        if (active) setRoleLoading(false);
      }
    };
    loadProfile();
    return () => {
      active = false;
    };
  }, []);

  const isBlocked = useMemo(
    () => blockedByError || !isSubscriptionActive(plan?.subscriptionStatus, plan?.currentPeriodEndUtc),
    [blockedByError, plan]
  );
  const roleRestrictedRoutes = useMemo(
    () => ({
      viewer: ["/review", "/rules", "/devices", "/sources", "/plan", "/admin/invite"],
      manager: ["/rules", "/devices", "/sources", "/plan"]
    }),
    []
  );
  const isViewerRestricted = isViewer && roleRestrictedRoutes.viewer.some((route) => pathname?.startsWith(route));
  const isManagerRestricted = isManager && roleRestrictedRoutes.manager.some((route) => pathname?.startsWith(route));

  const handlePayNow = async () => {
    if (!plan) {
      setPlanError("Plan details are not available yet.");
      return;
    }

    setPlanError(null);
    try {
      const portal = await postJson<{ url?: string }, Record<string, never>>("/api/billing/portal", {});
      if (portal.url) {
        window.location.href = portal.url;
        return;
      }
    } catch {
      // Fall back to checkout when no portal is available.
    }

    try {
      const checkout = await postJson<{ checkoutUrl?: string }, { planId: string }>("/api/billing/checkout", {
        planId: plan.planId
      });
      if (checkout.checkoutUrl) {
        window.location.href = checkout.checkoutUrl;
        return;
      }
      throw new Error("Checkout URL missing");
    } catch (err) {
      setPlanError((err as any).message ?? "Unable to start checkout.");
    }
  };

  return (
    <RoleProvider role={role}>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100">
        <div className="flex min-h-screen">
          <aside className="hidden w-68 flex-shrink-0 border-r border-slate-200 bg-white/90 px-4 py-6 backdrop-blur md:flex md:flex-col md:gap-6">
            <Logo />
            <NavLinks isBlocked={isBlocked} role={role} roleLoading={roleLoading} />
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
                <NavLinks isBlocked={isBlocked} role={role} roleLoading={roleLoading} onClick={() => setOpen(false)} />
              </div>
            )}
            <TopBar isBlocked={isBlocked} role={role} />
            {(isBlocked || (!isViewer && !isManager)) && (
              <PlanBanner plan={plan} error={planError} loading={planLoading} onPayNow={handlePayNow} />
            )}
            <div
              className={`mt-4 space-y-4 ${
                isViewerRestricted || isManagerRestricted || !isBlocked ? "" : "pointer-events-none opacity-60"
              }`}
            >
              {isViewerRestricted || isManagerRestricted ? <AdminOnlyNotice /> : children}
            </div>
            <Footer />
          </main>
        </div>
      </div>
    </RoleProvider>
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

function TopBar({ isBlocked, role }: { isBlocked: boolean; role: string | null }) {
  const isViewer = role?.toLowerCase() === "viewer";
  const isManager = role?.toLowerCase() === "manager";
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-2">
        <div className="hidden text-xs font-semibold uppercase tracking-wide text-slate-500 md:block">Dashboard</div>
        <div className="h-5 w-px bg-slate-200 md:block" />
        <div className="text-sm text-slate-600">Stay on top of certificates and review queue</div>
      </div>
      <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-center md:gap-3 md:justify-end">
        <div className="flex w-full items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-inner md:w-80">
          <svg className="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            className="w-full border-0 bg-transparent text-sm focus:outline-none"
            placeholder="Search staff, course, issuer..."
            aria-label="Search"
            disabled={isBlocked}
          />
        </div>
        <Link
          href="/uploads"
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm ${
            isBlocked ? "bg-slate-300 cursor-not-allowed" : "bg-gradient-to-r from-indigo-500 to-blue-500 hover:opacity-95"
          }`}
          aria-disabled={isBlocked}
          tabIndex={isBlocked ? -1 : 0}
          onClick={(event) => {
            if (isBlocked) event.preventDefault();
          }}
        >
          New upload
        </Link>
        {!isViewer && (
          <Link
            href="/review"
            className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold shadow-sm ${
              isBlocked
                ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
            }`}
            aria-disabled={isBlocked}
            tabIndex={isBlocked ? -1 : 0}
            onClick={(event) => {
              if (isBlocked) event.preventDefault();
            }}
          >
            Review queue
          </Link>
        )}
      </div>
    </div>
  );
}

function NavLinks({
  isBlocked,
  role,
  roleLoading,
  onClick
}: {
  isBlocked: boolean;
  role: string | null;
  roleLoading: boolean;
  onClick?: () => void;
}) {
  const [reviewCount, setReviewCount] = useState<number>(0);
  const pathname = usePathname();
  const allowedWhenBlocked = useMemo(() => new Set(["/plan", "/profile", "/logout"]), []);
  const roleLower = role?.toLowerCase();
  const filteredItems = useMemo(() => {
    return navItems.filter((item) => {
      if (roleLower === "viewer" && item.viewerHidden) return false;
      if (roleLower === "manager" && item.managerHidden) return false;
      return true;
    });
  }, [roleLower]);

  useEffect(() => {
    if (roleLower === "viewer" || roleLoading) {
      setReviewCount(0);
      return;
    }

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
  }, [isViewer, roleLoading]);

  return (
    <nav className="space-y-1">
      {filteredItems.map((item) => {
        const showBadge = item.href === "/review" && reviewCount > 0;
        const active = pathname?.startsWith(item.href);
        const disabled = isBlocked && !allowedWhenBlocked.has(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClick}
            className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold transition ${
              disabled
                ? "cursor-not-allowed text-slate-400"
                : active
                ? "bg-gradient-to-r from-indigo-50 to-blue-50 text-indigo-700 border border-indigo-100"
                : "text-slate-700 hover:bg-slate-100"
            }`}
            aria-disabled={disabled}
            tabIndex={disabled ? -1 : 0}
            onClickCapture={(event) => {
              if (disabled) event.preventDefault();
            }}
          >
            <span className="flex items-center gap-2">
              <NavIcon name={item.icon} active={active} />
              {item.label}
            </span>
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

function AdminOnlyNotice() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      This area is available to admins only. If you need access, ask your admin to update your role.
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-6 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-xs text-slate-500 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <span>(c) {new Date().getFullYear()} CertiWatch. All rights reserved.</span>
        <span className="flex items-center gap-3">
          <a href="/terms" className="hover:text-slate-800">
            Terms
          </a>
          <a href="/privacy" className="hover:text-slate-800">
            Privacy
          </a>
          <a href="/support" className="hover:text-slate-800">
            Support
          </a>
        </span>
      </div>
    </footer>
  );
}

function NavIcon({ name, active }: { name?: string; active?: boolean }) {
  const wrap = active ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600";
  const icon = renderIcon(name ?? "default");
  return (
    <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${wrap}`} aria-hidden="true">
      {icon}
    </span>
  );
}

function renderIcon(name: string) {
  const base = "h-4 w-4";
  switch (name) {
    case "chart":
      return (
        <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M4 20h16M6 17V9m6 8V4m6 13v-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "table":
      return (
        <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="4" y="5" width="16" height="14" rx="2" />
          <path d="M4 10h16M9 5v14" strokeLinecap="round" />
        </svg>
      );
    case "flag":
      return (
        <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M5 4v16M5 4h10l-2 4 4 4H5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "shield":
      return (
        <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M12 3 5 6v6c0 3.5 2.6 6.8 7 9 4.4-2.2 7-5.5 7-9V6l-7-3Z" />
        </svg>
      );
    case "cpu":
      return (
        <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="7" y="7" width="10" height="10" rx="2" />
          <path d="M4 10v4M20 10v4M10 4h4M10 20h4M7 4v2M17 4v2M7 18v2M17 18v2" strokeLinecap="round" />
        </svg>
      );
    case "cloud":
      return (
        <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M7 17h9a4 4 0 0 0 0-8 6 6 0 0 0-11 2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M7 17h8" strokeLinecap="round" />
        </svg>
      );
    case "plug":
      return (
        <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M7 2v5m10-5v5M6 9h12l-1 6a5 5 0 0 1-5 4 5 5 0 0 1-5-4L6 9Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "credit":
      return (
        <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 9h18M7 15h3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "users":
      return (
        <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="9" cy="9" r="3" />
          <path d="M4 20a5 5 0 0 1 10 0" />
          <circle cx="17" cy="8" r="2" />
          <path d="M17 14a4 4 0 0 1 4 4" />
        </svg>
      );
    case "exit":
      return (
        <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M10 6v12M6 6v12" strokeLinecap="round" />
          <path d="m14 9 3 3-3 3M17 12H9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "user":
      return (
        <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="12" cy="8" r="3" />
          <path d="M6 20a6 6 0 0 1 12 0" />
        </svg>
      );
    default:
      return (
        <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
}

function isSubscriptionActive(status?: string | null, currentPeriodEndUtc?: string | null) {
  if (!status) return true;
  const normalized = status.trim().toLowerCase();
  if (normalized === "active" || normalized === "trialing") return true;
  if (normalized === "canceled" && currentPeriodEndUtc) {
    const end = new Date(currentPeriodEndUtc);
    return !isNaN(end.getTime()) && end > new Date();
  }
  return false;
}
