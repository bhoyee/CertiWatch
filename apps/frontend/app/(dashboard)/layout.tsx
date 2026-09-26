"use client";

import Link from "next/link";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { fetchJson, postJson } from "../../lib/api";
import { NotificationBell } from "./NotificationBell";
import { PlanBanner } from "./PlanBanner";
import { RoleProvider } from "./RoleContext";
import { LogoMark } from "../../components/LogoMark";
import { navItems, isNavItemVisibleForRole } from "./navItems";
import { GlobalSearch } from "./GlobalSearch";

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
  id?: string;
  email: string;
  role: string;
  name?: string | null;
  tenantName: string;
};


export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<TenantPlanDto | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [showTour, setShowTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const isViewer = role?.toLowerCase() === "viewer";
  const isManager = role?.toLowerCase() === "manager";
  const roleLower = role?.toLowerCase();
  const isSuper = roleLower === "superadmin";
  const tourSteps = useMemo(() => getTourSteps(role, isSuper), [role, isSuper]);
  const blockedByError =
    planError?.toLowerCase().includes("subscription inactive") ||
    planError?.toLowerCase().includes("payment") ||
    planError?.toLowerCase().includes("plan");

  // Silent (no spinner) plan refresh - used both by the mount-time load below and by
  // refreshPlan() in RoleContext, which any page can call right after an action that changes a
  // count the banner shows (deleting records, etc.) instead of leaving it stale until the next
  // navigation or a manual reload.
  const loadPlan = useCallback(async () => {
    try {
      const res = await fetchJson<TenantPlanDto>("/api/tenant/me");
      setPlan(res);
      setPlanError(null);
    } catch (err) {
      setPlanError((err as any).message ?? "Failed to load plan");
    }
  }, []);

  useEffect(() => {
    if (roleLoading) return;
    if (isSuper) {
      setPlanLoading(false);
      setPlan(null);
      setPlanError(null);
      return;
    }
    setPlanLoading(true);
    loadPlan().finally(() => setPlanLoading(false));
  }, [isSuper, roleLoading, loadPlan]);

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      try {
        const res = await fetchJson<ProfileDto>("/api/profile");
        if (active) {
          setRole(res.role);
          setUserId(res.id ?? null);
        }
      } catch {
        if (active) {
          setRole(null);
          setUserId(null);
        }
      } finally {
        if (active) setRoleLoading(false);
      }
    };
    loadProfile();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!roleLower) return;
    if (roleLower === "superadmin" && pathname && !pathname.startsWith("/platform")) {
      router.replace("/platform/tenants");
    }
  }, [pathname, roleLower, router]);

  useEffect(() => {
    if (!roleLower) return;
    if (roleLower === "superadmin" && pathname && !pathname.startsWith("/platform")) {
      router.replace("/platform/tenants");
    }
  }, [roleLower, pathname, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = localStorage.getItem("cw_onboarding_seen_v1");
    if (!seen) {
      setShowTour(true);
    }
  }, []);

  const isBlocked = useMemo(
    () =>
      isSuper ? false : blockedByError || !isSubscriptionActive(plan?.subscriptionStatus, plan?.currentPeriodEndUtc),
    [blockedByError, isSuper, plan]
  );
  const roleRestrictedRoutes = useMemo(
    () => ({
      viewer: ["/review", "/requirements", "/devices", "/sources", "/plan", "/invite", "/staff", "/compliance"],
      manager: ["/requirements", "/devices", "/sources", "/plan"]
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
    <RoleProvider role={role} refreshPlan={loadPlan}>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100">
        <div className="flex min-h-screen">
          <aside className="hidden w-68 flex-shrink-0 border-r border-slate-200 bg-white/90 px-4 py-6 backdrop-blur md:flex md:flex-col md:gap-6">
            <Logo isSuper={isSuper} />
            <NavLinks isBlocked={isBlocked} role={role} roleLoading={roleLoading} isSuper={isSuper} userId={userId} />
          </aside>
          {/* min-w-0 overrides the flex-item default of min-width:auto - without it, wide
              content (e.g. the Compliance table's many columns) forces this whole flex item
              to grow past the viewport instead of scrolling within its own container. */}
          {/* flex flex-col here, plus mt-auto on Footer below, is the standard "sticky footer"
              technique - pins the footer to the bottom of the viewport on short pages instead
              of it floating right under whatever content happens to be there, while still
              scrolling normally (not overlapping content) on tall pages. */}
          <main className="flex min-w-0 flex-1 flex-col px-4 py-6 md:px-10">
            <div className="mb-4 flex items-center justify-between md:hidden">
              <Logo isSuper={isSuper} />
              <button
                onClick={() => setOpen((v) => !v)}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm"
              >
                Menu
              </button>
            </div>
            {open && (
              <div className="mb-4 rounded-lg border border-slate-200 bg-white p-3 shadow-sm md:hidden">
                <NavLinks
                  isBlocked={isBlocked}
                  role={role}
                  roleLoading={roleLoading}
                  isSuper={isSuper}
                  userId={userId}
                  onClick={() => setOpen(false)}
                />
              </div>
            )}
            <TopBar isBlocked={isBlocked} role={role} isSuper={isSuper} onShowTour={() => setShowTour(true)} />
            {(!isSuper && (isBlocked || (!isViewer && !isManager))) && (
              <PlanBanner plan={plan} error={planError} loading={planLoading} onPayNow={handlePayNow} />
            )}
            <div
              className={`mt-4 space-y-4 ${
                isViewerRestricted || isManagerRestricted || !isBlocked ? "" : "pointer-events-none opacity-60"
              }`}
            >
              {isViewerRestricted || isManagerRestricted ? <AdminOnlyNotice /> : children}
            </div>
            {/* Grows to fill any leftover space on short pages, pinning Footer to the bottom of
                the viewport; collapses to 0 on tall pages, leaving Footer's own mt-6 as the gap. */}
            <div className="flex-1" />
            <Footer />
          </main>
        </div>
        <OnboardingTour
          open={showTour}
          step={tourStep}
          steps={tourSteps}
          onClose={(markSeen) => {
            setShowTour(false);
            setTourStep(0);
            if (markSeen && typeof window !== "undefined") {
              localStorage.setItem("cw_onboarding_seen_v1", "true");
            }
          }}
          onNext={() => setTourStep((s) => Math.min(s + 1, tourSteps.length - 1))}
          onPrev={() => setTourStep((s) => Math.max(0, s - 1))}
        />
      </div>
    </RoleProvider>
  );
}

function Logo({ isSuper }: { isSuper?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-1">
      <LogoMark className="h-10 w-10 shrink-0 drop-shadow-sm" />
      <div>
        <Link href={isSuper ? "/platform/tenants" : "/analytics"} className="text-lg font-semibold text-slate-900">
          CertiWatch
        </Link>
        <p className="text-xs text-slate-500">Compliance dashboard</p>
      </div>
    </div>
  );
}

function TopBar({
  isBlocked,
  role,
  isSuper,
  onShowTour
}: {
  isBlocked: boolean;
  role: string | null;
  isSuper?: boolean;
  onShowTour: () => void;
}) {
  const isViewer = role?.toLowerCase() === "viewer";
  const isManager = role?.toLowerCase() === "manager";
  return (
    <div className="relative z-40 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-2">
        <div className="hidden bg-gradient-to-r from-indigo-600 to-blue-500 bg-clip-text text-sm font-extrabold uppercase tracking-wider text-transparent md:block">
          Dashboard
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:gap-3 md:justify-end">
        <GlobalSearch isBlocked={isBlocked} role={role} isSuper={isSuper} />
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
                : "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
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
        <button
          onClick={onShowTour}
          aria-label="Show tour"
          title="Show tour"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-700 shadow-sm transition hover:bg-amber-100"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5">
            <circle cx="12" cy="12" r="9" />
            <path d="M9.5 9.5a2.5 2.5 0 0 1 4.6-1.4c.6.9.3 1.7-.5 2.4-.7.6-1.1 1-1.1 2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 17h.01" strokeLinecap="round" />
          </svg>
        </button>
        {!isViewer && <NotificationBell />}
      </div>
    </div>
  );
}

function NavLinks({
  isBlocked,
  role,
  roleLoading,
  isSuper,
  userId,
  onClick
}: {
  isBlocked: boolean;
  role: string | null;
  roleLoading: boolean;
  isSuper?: boolean;
  userId?: string | null;
  onClick?: () => void;
}) {
  const [reviewCount, setReviewCount] = useState<number>(0);
  const [supportCount, setSupportCount] = useState<number>(0);
  const pathname = usePathname();
  const allowedWhenBlocked = useMemo(() => new Set(["/plan", "/profile", "/logout"]), []);
  const roleLower = role?.toLowerCase();
  const isViewer = roleLower === "viewer";
  const isSuperRole = isSuper || roleLower === "superadmin";
  const currentUserId = userId ?? null;
  const filteredItems = useMemo(
    () => navItems.filter((item) => isNavItemVisibleForRole(item, role, isSuperRole)),
    [isSuperRole, role]
  );

  useEffect(() => {
    if (isViewer || roleLoading || isSuperRole) {
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
    const id = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [isViewer, roleLoading, isSuperRole]);

  useEffect(() => {
    let active = true;
    if (isSuperRole) {
      setSupportCount(0);
      return;
    }
    const load = async () => {
      try {
        const tickets = await fetchJson<Array<{ status: string; createdByUserId?: string | null }>>(
          "/api/support/tickets"
        );
        if (active) {
          const count = tickets.filter(
            (t) =>
              (t.status === "open" || t.status === "pending") &&
              (!currentUserId || (t.createdByUserId ?? "").toLowerCase() !== currentUserId.toLowerCase())
          ).length;
          setSupportCount(count);
        }
      } catch {
        if (active) setSupportCount(0);
      }
    };
    load();
    const id = setInterval(load, 8000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [isSuperRole, currentUserId]);

  return (
    <nav className="space-y-1">
      {filteredItems.map((item) => {
        const showBadge = item.href === "/review" && reviewCount > 0;
        const showSupportBadge = item.href === "/support" && supportCount > 0;
        const active = pathname?.startsWith(item.href);
        const disabled = isBlocked && !allowedWhenBlocked.has(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            data-tour={item.href}
            onClick={onClick}
            className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold transition ${
              item.divider ? "mt-4 border-t border-slate-200 pt-4" : ""
            } ${
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
            {(showBadge || showSupportBadge) && (
              <span className="ml-2 rounded-full bg-rose-600 px-2 py-0.5 text-xs font-semibold text-white">
                {showBadge ? reviewCount : supportCount}
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

type TourStep = { href: string; title: string; body: string };

// One master list, in sidebar order, each tied to a real nav href - not a hand-written per-role
// list that could quietly drift from what's actually in the sidebar. getTourSteps below filters
// this exactly the way the sidebar itself decides what to show a given role (see
// isNavItemVisibleForRole), so a step can never point at something this role doesn't have.
const TOUR_STEP_CONTENT: TourStep[] = [
  { href: "/analytics", title: "Dashboard", body: "A live overview of your records, what's expiring soon, and anything that needs attention." },
  { href: "/uploads", title: "Uploads", body: "Add certificates here - a single file, a bulk batch, or a no-login link you can send to a staff member." },
  { href: "/review", title: "Review queue", body: "Anything CertiWatch wasn't fully confident about lands here for a quick check before it counts as official." },
  { href: "/records", title: "Records", body: "Every processed certificate - searchable, sortable, and exportable to CSV or PDF." },
  { href: "/compliance", title: "Compliance", body: "Every staff member against every requirement, at a glance - the page to check before an inspection." },
  { href: "/requirements", title: "Requirements", body: "The certificate types CertiWatch checks against, plus reminder timing and manager-visibility settings." },
  { href: "/invite", title: "Team & roles", body: "Invite your team and set what each person can see and do." },
  { href: "/plan", title: "Billing & plan", body: "See usage against your plan's limit, and manage your subscription." }
];

function getTourSteps(role: string | null, isSuperRole: boolean): TourStep[] {
  return TOUR_STEP_CONTENT.filter((step) => {
    const navItem = navItems.find((n) => n.href === step.href);
    return navItem && isNavItemVisibleForRole(navItem, role, isSuperRole);
  });
}

// A standard "spotlight" product tour (Intercom/Appcues-style): each step highlights the actual
// sidebar item it's talking about and anchors a tooltip card next to it, rather than one generic
// card floating in the middle of the page regardless of what it's describing. Falls back to a
// centered card only if the target genuinely isn't on screen (the sidebar collapses below the md
// breakpoint, so this is what mobile gets automatically - no separate mobile-tour logic needed).
function OnboardingTour({
  open,
  step,
  steps,
  onClose,
  onNext,
  onPrev
}: {
  open: boolean;
  step: number;
  steps: TourStep[];
  onClose: (markSeen: boolean) => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  const current = steps[step];
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!open || !current) {
      setRect(null);
      return;
    }

    // The same href appears twice in the DOM (the desktop sidebar, kept mounted but
    // display:none below the md breakpoint, and the slide-down mobile menu) - pick whichever
    // copy is actually laid out rather than the first match, which on mobile is the hidden one
    // and would otherwise measure as a zero-size rect anchored at the top-left corner.
    const findVisible = () => {
      const candidates = document.querySelectorAll(`[data-tour="${current.href}"]`);
      for (const el of candidates) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) return r;
      }
      return null;
    };

    const measure = () => setRect(findVisible());

    document.querySelector(`[data-tour="${current.href}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });

    measure();
    // Re-measure once more shortly after, in case the scrollIntoView above was still animating
    // when the first measurement ran.
    const settle = setTimeout(measure, 350);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      clearTimeout(settle);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, current]);

  if (!open || !current) return null;
  const isLast = step === steps.length - 1;

  const card = (
    <div className="w-[320px] rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-black/5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600">
          Step {step + 1} of {steps.length}
        </p>
        <button
          onClick={() => onClose(true)}
          aria-label="Close tour"
          className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
            <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <h3 className="mt-2 text-base font-bold text-slate-900">{current.title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{current.body}</p>

      <div className="mt-4 flex items-center gap-1.5" aria-hidden="true">
        {steps.map((_, i) => (
          <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-5 bg-indigo-600" : "w-1.5 bg-slate-200"}`} />
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={onPrev}
          disabled={step === 0}
          className="rounded-full border border-slate-200 px-3.5 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-0"
        >
          Back
        </button>
        <button
          onClick={() => (isLast ? onClose(true) : onNext())}
          className="rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
        >
          {isLast ? "Done" : "Next"}
        </button>
      </div>
    </div>
  );

  // No target found - the sidebar is collapsed (mobile) or the item isn't rendered for some
  // other reason. Same centered presentation this tour used everywhere before, so it degrades
  // gracefully instead of breaking.
  if (!rect) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm" onClick={() => onClose(true)}>
        <div onClick={(e) => e.stopPropagation()}>{card}</div>
      </div>
    );
  }

  const GAP = 16;
  const CARD_WIDTH = 320;
  const placeRight = window.innerWidth - rect.right >= CARD_WIDTH + GAP + 24;
  const top = Math.min(Math.max(rect.top + rect.height / 2 - 90, 12), window.innerHeight - 300);
  const left = placeRight ? rect.right + GAP : Math.max(rect.left - CARD_WIDTH - GAP, 12);

  return (
    <>
      {/* Dims the page and highlights the target with a glowing ring, rather than a full SVG
          cutout mask - the simpler technique most lightweight product tours actually use, for a
          fraction of the code. */}
      <div className="fixed inset-0 z-50 bg-slate-900/50" onClick={() => onClose(true)} />
      <div
        className="pointer-events-none fixed z-50 rounded-xl transition-all"
        style={{
          top: rect.top - 6,
          left: rect.left - 6,
          width: rect.width + 12,
          height: rect.height + 12,
          boxShadow: "0 0 0 4px rgba(99,102,241,0.35), 0 0 0 9999px rgba(15,23,42,0.001), 0 0 28px rgba(99,102,241,0.45)",
          background: "rgba(255,255,255,0.06)"
        }}
      />
      <div className="fixed z-50" style={{ top, left }} onClick={(e) => e.stopPropagation()}>
        <div
          className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 bg-white ${placeRight ? "-left-1.5" : "-right-1.5"}`}
          aria-hidden="true"
        />
        {card}
      </div>
    </>
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
    case "book":
      return (
        <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15.5H6.5A2.5 2.5 0 0 0 4 21V5.5Z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20" strokeLinecap="round" strokeLinejoin="round" />
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
