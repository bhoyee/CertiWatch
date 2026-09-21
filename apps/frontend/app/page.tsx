"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { display, body } from "@/lib/fonts";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

// Uses the same brand system as /login and /signup - lib/fonts, SiteHeader/SiteFooter, the
// dark #12140F panel with a faint grid texture, and the #1F6B45 green accent - instead of a
// bespoke visual language invented just for this page. Three earlier passes each committed to
// their own look (a vintage ledger, a generic modern-SaaS kit, a paper/photography treatment)
// and every one of them made the landing page feel like a different product from the app it
// leads into. This is the fix: reuse what's already there.
const GRID_TEXTURE = {
  backgroundImage: "linear-gradient(#F5F3EE 1px, transparent 1px), linear-gradient(90deg, #F5F3EE 1px, transparent 1px)",
  backgroundSize: "48px 48px"
};

type IconProps = { className?: string };
function IconBell({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <path d="M6.5 16.5v-4.8a5.5 5.5 0 0 1 11 0v4.8L19 18.7H5Z" strokeLinejoin="round" />
      <path d="M10.2 20.5a1.8 1.8 0 0 0 3.6 0" strokeLinecap="round" />
    </svg>
  );
}
function IconInbox({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <path d="M4 13.5h4.6l1.3 2h4.2l1.3-2H20" strokeLinejoin="round" />
      <path d="M5.4 13.5 7 6h10l1.6 7.5" strokeLinejoin="round" />
    </svg>
  );
}
function IconCheckShield({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <path d="M12 3.5 5 6.2v5.3c0 4.3 3 7.6 7 8.9 4-1.3 7-4.6 7-8.9V6.2L12 3.5Z" strokeLinejoin="round" />
      <path d="m9 12 2.2 2.2L15.5 10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconLock({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <rect x="5.5" y="11" width="13" height="8.5" rx="1.5" />
      <path d="M8.2 11V7.8a3.8 3.8 0 0 1 7.6 0V11" />
    </svg>
  );
}

const steps = [
  {
    eyebrow: "To start",
    icon: IconLock,
    title: "Enroll",
    description: "Register a device agent, or connect Google Drive or Microsoft OneDrive with a short-lived code — no shared passwords, ever."
  },
  {
    eyebrow: "Then",
    icon: IconInbox,
    title: "Ingest",
    description: "New documents land from a watched folder, a connected drive, or a no-login upload link you can send to anyone."
  },
  {
    eyebrow: "Next",
    icon: IconCheckShield,
    title: "Extract & review",
    description: "OCR reads who it's for, the issuer, and the dates. Anything uncertain is held in a review queue instead of guessed at."
  },
  {
    eyebrow: "Finally",
    icon: IconBell,
    title: "Track & remind",
    description: "The record lands on the right person's row in the compliance matrix, and reminders go out before it becomes a problem."
  }
];

const faqs = [
  {
    question: "How does onboarding work?",
    answer:
      "Pick a plan, complete Stripe checkout, and your tenant is provisioned automatically. Add your staff, enroll a device or connect Google Drive/OneDrive, and start ingesting documents right away."
  },
  {
    question: "Where are documents stored?",
    answer:
      "Once a document is processed, we keep a secure archived copy — encrypted in transit and at rest — for the review screen, exports, and audits. Nothing is deleted from wherever you originally dropped it. Cloud connectors (Google Drive, Microsoft OneDrive) use read-only access."
  },
  {
    question: "What documents does it actually read reliably?",
    answer:
      "Person-specific certificates, qualifications, licences, and DBS checks — anything with a named individual, an issuer, and a date. It's not built for property or business paperwork like an EPC or a gas safety certificate; see the in-app documentation for the full picture."
  },
  {
    question: "Do you support trials?",
    answer:
      "Yes — a 7-day trial, card required up front. One trial per customer; billing begins automatically on day 7 unless you cancel first."
  }
];

// The only thing that actually differs by plan on the backend is how many staff certifications
// count toward your allowance (see PlanLimits.GetActiveRecordIdsAsync) - there's no code-level
// gating on ingestion channels, retention, or an API that doesn't exist. So the tiers are honest
// about that: same platform on every plan, sized by how many people you're tracking - not three
// different feature lists invented to make three columns look different. The allowance is a
// standing total, not a monthly quota that resets - and renewing a certificate you already track
// never counts against it, only a new staff member or a newly-tracked requirement does. It's sized
// generously against the staff count so a full onboarding import (everyone's existing history at
// once) fits comfortably inside the plan that actually matches your headcount.
const sharedFeatures = [
  "Staff directory & live compliance matrix",
  "Local folder, Google Drive & OneDrive ingestion",
  "Custom requirement rules per tenant",
  "Weekly digest + expiry reminders",
  "Role-scoped access for admins, managers & viewers"
];

const plans = [
  {
    name: "Starter",
    price: "$99",
    blurb: "For small teams tracking their first few renewal dates.",
    limit: "Up to 15 staff",
    support: "Standard support"
  },
  {
    name: "Growth",
    price: "$249",
    blurb: "For growing orgs juggling certs, licenses, and insurance.",
    limit: "Up to 75 staff",
    support: "Standard support",
    highlighted: true
  },
  {
    name: "Pro",
    price: "$499",
    blurb: "For ops teams tracking everything that could lapse.",
    limit: "Unlimited staff",
    support: "Priority support"
  }
];

// Distinct hues per sector rather than one flat color - deliberately not reusing the
// compliant/expiring/expired greens-and-reds from the matrix spotlight below, so a badge here
// never reads as a status. Kept muted/pastel to match the page's warm paper palette.
const industries = [
  { name: "Care homes", classes: "bg-[#EDF5EF] text-[#1F6B45]" },
  { name: "Construction", classes: "bg-[#FBEEE3] text-[#A15A2A]" },
  { name: "Hospitality", classes: "bg-[#F5EAF0] text-[#8A3E63]" },
  { name: "Facilities", classes: "bg-[#EAF0F5] text-[#2F5D82]" }
];

// The compliance-report spotlight - a preview of the real /compliance screen, built to match what
// that screen (and its CSV/HTML export - see ComplianceEndpoints.cs) actually produce: one row per
// (staff, requirement) pair, not a per-person summary, and the exact compliant/expiring/expired
// segment colors the real generated report uses (#10b981/#f59e0b/#ef4444 in BuildReportHtml).
type MatrixStatus = "compliant" | "expiring" | "expired";
const matrixStatusStyles: Record<MatrixStatus, string> = {
  compliant: "bg-[#EDF5EF] text-[#1F6B45]",
  expiring: "bg-[#FBF3DC] text-[#92700E]",
  expired: "bg-[#FBECEA] text-[#B3432B]"
};
const matrixSegmentColors: Record<MatrixStatus, string> = {
  compliant: "#10b981",
  expiring: "#f59e0b",
  expired: "#ef4444"
};
const matrixStatusLabels: Record<MatrixStatus, string> = {
  compliant: "Compliant",
  expiring: "Expiring",
  expired: "Expired"
};
const matrixOverall: { status: MatrixStatus; pct: number }[] = [
  { status: "compliant", pct: 82 },
  { status: "expiring", pct: 11 },
  { status: "expired", pct: 7 }
];
const matrixRows: { name: string; requirement: string; status: MatrixStatus; expiry: string }[] = [
  { name: "Jordan Diaz", requirement: "First Aid at Work", status: "compliant", expiry: "12 Mar 2027" },
  { name: "Jordan Diaz", requirement: "DBS Check", status: "compliant", expiry: "04 Aug 2026" },
  { name: "Sam Whitlock", requirement: "Food Hygiene", status: "expiring", expiry: "03 Oct 2026" },
  { name: "Priya Nair", requirement: "Manual Handling", status: "expired", expiry: "18 Jul 2026" },
  { name: "Priya Nair", requirement: "Fire Safety", status: "compliant", expiry: "22 Jan 2027" }
];

export default function LandingPage() {
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    setHasSession(document.cookie.includes("cw_session="));
  }, []);

  return (
    <div className={`${display.variable} ${body.variable} font-[family-name:var(--font-body)] min-h-screen bg-[#FAF7F0] text-[#1B1B16]`}>
      <SiteHeader />

      {/* Hero - same dark panel + grid texture + plain-text eyebrow as the login page's brand
          panel, extended to full width with a headline, CTAs, and the same icon-in-circle trust
          list pattern instead of a decorative illustration. */}
      <section className="relative overflow-hidden bg-[#12140F] py-20 md:py-28">
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={GRID_TEXTURE} />
        <div className="relative mx-auto grid max-w-6xl gap-14 px-6 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4E9C74]">Every renewal, handled</p>
            <h1 className="mt-4 max-w-xl font-[family-name:var(--font-display)] text-4xl font-medium leading-[1.12] text-[#F5F3EE] md:text-5xl">
              Stop finding out something's expired <span className="italic text-[#4E9C74]">after</span> the inspector does.
            </h1>
            <p className="mt-5 max-w-lg leading-relaxed text-[#C9C7BC]">
              CertiWatch watches every folder and cloud drive your staff certificates, licenses, and inspection
              documents land in, reads the expiry off the page, matches it to the right person, and tells you —
              and only you — before it runs out.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {hasSession ? (
                <Link
                  href="/analytics"
                  className="inline-flex items-center justify-center rounded-md bg-[#1F6B45] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#195939]"
                >
                  Go to dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/signup"
                    className="inline-flex items-center justify-center rounded-md bg-[#1F6B45] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#195939]"
                  >
                    Start 7-day trial
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center rounded-md border border-white/15 px-6 py-3 text-sm font-semibold text-[#F5F3EE] transition hover:bg-white/5"
                  >
                    Log in
                  </Link>
                </>
              )}
            </div>
            <p className="mt-6 text-xs uppercase tracking-wide text-[#6B6A61]">
              7-day free trial · Card required upfront · Cancel anytime before billing starts
            </p>
          </div>

          {/* Hero visual - the real generated certificate photograph (stamped, cast shadow, on
              its own transparent canvas) floating on the dark panel with a soft green glow,
              plus a small UI notification chip bridging "a real document" to "the product that
              watches it". */}
          <div className="relative mx-auto w-full max-w-xl md:max-w-none md:-mr-20 lg:-mr-32">
            <div aria-hidden="true" className="absolute -inset-10 rounded-[3rem] bg-[#4E9C74]/10 blur-3xl" />
            <img
              src="/landing/certificate-hero.png"
              alt="A CertiWatch compliance certificate, stamped Compliant"
              className="relative w-full drop-shadow-2xl"
            />
            <div className="absolute -bottom-2 -left-4 hidden items-center gap-2.5 rounded-xl border border-black/5 bg-[#F5F3EE] px-3.5 py-2.5 shadow-xl shadow-black/30 sm:flex">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EDF2EC] text-[#1F6B45]">
                <IconBell />
              </span>
              <div className="leading-tight">
                <p className="text-xs font-semibold text-[#1B1B16]">Reminder sent</p>
                <p className="text-[11px] text-[#8A8A7E]">12 days before expiry</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip - who it's for, plus the two capabilities that aren't already shown
          concretely elsewhere (the How-it-works steps and the matrix spotlight below cover
          ingestion/review/reminders on their own; custom rules and role-scoped access don't get
          a visual anywhere else, so they're named here instead of earning a whole card each). */}
      <section className="border-b border-[#E5E0D2] bg-white py-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-6 text-center md:flex-row md:justify-between md:text-left">
          <p className="text-sm font-medium text-[#6B6A61]">Built for teams that can't afford to guess</p>
          <div className="flex flex-wrap items-center justify-center gap-2 md:justify-end">
            {industries.map((industry) => (
              <span key={industry.name} className={`rounded-full px-3 py-1 text-xs font-semibold ${industry.classes}`}>
                {industry.name}
              </span>
            ))}
          </div>
        </div>
        <div className="mx-auto mt-3 max-w-6xl px-6 text-center md:text-left">
          <p className="text-xs text-[#8A8A7E]">
            Custom rules per document type &nbsp;·&nbsp; role-scoped access for admins, managers &amp; viewers
          </p>
        </div>
      </section>

      {/* Compliance report spotlight - a preview of the real /compliance screen, so the
          headline feature is something you can actually see rather than just a bullet point. */}
      <section className="border-y border-[#E5E0D2] bg-[#FCFAF5] py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1F6B45]">Compliance report</p>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-medium text-[#1B1B16] md:text-4xl">
              Every staff member, every requirement, one screen.
            </h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[#6B6A61]">
              No spreadsheet to maintain — the matrix recalculates the moment a document is
              accepted or a rule changes. Filter to who's expiring, export a CSV for an
              inspector, or print an audit-ready report in one click.
            </p>
            <ul className="mt-6 space-y-3">
              {["Compliant, expiring, and expired — always current", "Filter, search, and export in one click", "The same view an inspector would ask to see"].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-[#1B1B16]">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1F6B45]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Framed as an app window (dot chrome + fake address bar) rather than a bare card, so
              it reads as a screenshot of running software instead of decorative UI art - and its
              contents mirror the real export's shape: one row per (staff, requirement) pair, an
              overall segmented bar, dated like an audit document. */}
          <div className="overflow-hidden rounded-2xl border border-[#E5E0D2] bg-white shadow-lg shadow-black/5 transition duration-200 hover:-translate-y-1 hover:shadow-xl">
            <div className="flex items-center gap-1.5 border-b border-[#EFEAE0] bg-[#FAF8F3] px-4 py-2.5">
              <span className="h-2 w-2 rounded-full bg-[#E7A97A]" />
              <span className="h-2 w-2 rounded-full bg-[#E8C97A]" />
              <span className="h-2 w-2 rounded-full bg-[#8FBBA2]" />
              <span className="ml-2.5 truncate text-[11px] font-medium text-[#9B9A8E]">app.certiwatch.com/compliance</span>
            </div>

            <div className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-[family-name:var(--font-display)] text-base font-medium text-[#1B1B16]">Hull House</p>
                  <p className="text-xs text-[#8A8A7E]">Compliance register &middot; generated 21 Sep 2026</p>
                </div>
                <span className="shrink-0 rounded-md border border-[#E5E0D2] px-2.5 py-1.5 text-[11px] font-semibold text-[#4B4A42]">
                  Export CSV
                </span>
              </div>

              {/* Overall bar - same three-color split and legend pattern as the real generated
                  report (BuildReportHtml's .overall-bar), not a chart invented just for marketing. */}
              <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-[#F1EFE7]">
                {matrixOverall.map((seg) => (
                  <span key={seg.status} style={{ width: `${seg.pct}%`, backgroundColor: matrixSegmentColors[seg.status] }} />
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {matrixOverall.map((seg) => (
                  <span key={seg.status} className="flex items-center gap-1.5 text-[11px] text-[#8A8A7E]">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: matrixSegmentColors[seg.status] }} />
                    {matrixStatusLabels[seg.status]} {seg.pct}%
                  </span>
                ))}
              </div>

              {/* Toolbar - decorative (this is a static preview, not a live search/filter) but
                  named after the exact controls the real /compliance page has. */}
              <div className="mt-4 flex items-center gap-2">
                <span className="flex-1 rounded-md border border-[#E5E0D2] px-2.5 py-1.5 text-[11px] text-[#9B9A8E]">Search staff or requirement&hellip;</span>
                <span className="rounded-md border border-[#E5E0D2] px-2.5 py-1.5 text-[11px] text-[#6B6A61]">All statuses ▾</span>
              </div>

              <div className="mt-4 overflow-hidden rounded-lg border border-[#EFEAE0]">
                <div className="grid grid-cols-[1.3fr_1.3fr_0.9fr_0.9fr] gap-2 bg-[#FAF8F3] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-[#9B9A8E]">
                  <span>Staff</span>
                  <span>Requirement</span>
                  <span>Status</span>
                  <span>Expires</span>
                </div>
                {matrixRows.map((row, i) => (
                  <div
                    key={`${row.name}-${row.requirement}`}
                    className={`grid grid-cols-[1.3fr_1.3fr_0.9fr_0.9fr] items-center gap-2 px-3 py-2.5 text-[11px] ${i > 0 ? "border-t border-[#EFEAE0]" : ""}`}
                  >
                    <span className="truncate font-medium text-[#1B1B16]">{row.name}</span>
                    <span className="truncate text-[#6B6A61]">{row.requirement}</span>
                    <span className={`inline-flex w-fit rounded-full px-2 py-0.5 font-semibold ${matrixStatusStyles[row.status]}`}>
                      {matrixStatusLabels[row.status]}
                    </span>
                    <span className="text-[#8A8A7E]">{row.expiry}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works - icons on a connecting line instead of numbered circles, framed in its
          own soft panel for a more considered, editorial feel than a plain full-bleed grid. */}
      <section id="how" className="border-b border-[#E5E0D2] bg-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1F6B45]">How it works</p>
          <h2 className="mt-3 max-w-2xl font-[family-name:var(--font-display)] text-3xl font-medium text-[#1B1B16] md:text-4xl">
            From a scanned document to a peaceful audit.
          </h2>

          {/* Four independent cards, not one shared panel - each step stands on its own, and the
              connector between them carries a small animated pulse (a plain CSS keyframe, see
              globals.css) so the sequence reads as a live pipeline rather than a static diagram. */}
          <div className="mt-12 flex flex-col md:flex-row md:items-stretch">
            {steps.map((step, i) => (
              <div key={step.title} className="flex flex-1 flex-col md:flex-row md:items-stretch">
                <div className="flex-1 rounded-2xl border border-[#E5E0D2] bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-[#1F6B45]/40 hover:shadow-lg hover:shadow-black/5">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1F6B45] text-white shadow-md shadow-[#1F6B45]/25">
                    <step.icon className="h-5 w-5" />
                  </span>
                  <p className="mt-4 font-[family-name:var(--font-display)] text-sm italic text-[#1F6B45]">{step.eyebrow}</p>
                  <h3 className="mt-1 font-[family-name:var(--font-display)] text-lg font-medium text-[#1B1B16]">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#6B6A61]">{step.description}</p>
                </div>

                {i < steps.length - 1 && (
                  <div className="relative flex h-8 w-full items-center justify-center md:h-auto md:w-8 md:flex-col">
                    <span className="h-full w-px bg-[#E5E0D2] md:h-px md:w-full" />
                    <span
                      aria-hidden="true"
                      className="cw-flow-dot absolute h-2 w-2 rounded-full bg-[#4E9C74] shadow-[0_0_6px_rgba(78,156,116,0.8)] md:hidden"
                      style={{ animation: `cw-pulse-y 2.2s ease-in-out ${i * 0.5}s infinite` }}
                    />
                    <span
                      aria-hidden="true"
                      className="cw-flow-dot absolute hidden h-2 w-2 rounded-full bg-[#4E9C74] shadow-[0_0_6px_rgba(78,156,116,0.8)] md:block"
                      style={{ animation: `cw-pulse-x 2.2s ease-in-out ${i * 0.5}s infinite` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing - the exact plan-picker styling from /signup, so choosing a plan there feels
          like the same product, not a different page's idea of what a pricing card looks like. */}
      <section id="pricing" className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1F6B45]">Pricing</p>
          <h2 className="mt-3 max-w-2xl font-[family-name:var(--font-display)] text-3xl font-medium text-[#1B1B16] md:text-4xl">
            One platform, sized to your headcount.
          </h2>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[#6B6A61]">
            Every plan below runs the exact same product — the compliance matrix, both cloud connectors, custom
            rules, reminders, the lot. The only thing that changes is how many staff you're tracking, and every
            plan leaves generous headroom for onboarding a whole staff history at once.
          </p>

          {/* What's included everywhere - stated once so the three cards below aren't three
              invented feature lists pretending the tiers differ on capability. */}
          <ul className="mt-8 grid gap-x-8 gap-y-2.5 rounded-2xl border border-[#E5E0D2] bg-white p-6 sm:grid-cols-2 lg:grid-cols-3">
            {sharedFeatures.map((feat) => (
              <li key={feat} className="flex items-start gap-2.5 text-sm">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1F6B45]" />
                <span className="text-[#4B4A42]">{feat}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative flex flex-col rounded-2xl border p-6 transition duration-200 hover:-translate-y-1 ${
                  plan.highlighted
                    ? "border-[#1F6B45] bg-[#12140F] text-[#F5F3EE] shadow-xl shadow-black/10 hover:shadow-2xl"
                    : "border-[#E5E0D2] bg-white text-[#1B1B16] hover:border-[#1F6B45]/40 hover:shadow-lg hover:shadow-black/5"
                }`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 left-6 rounded-full bg-[#1F6B45] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                    Most popular
                  </span>
                )}
                <p className={`text-sm font-semibold uppercase tracking-wide ${plan.highlighted ? "text-[#8FBBA2]" : "text-[#6B6A61]"}`}>
                  {plan.name}
                </p>
                <p className="mt-2 flex items-baseline gap-1">
                  <span className="font-[family-name:var(--font-display)] text-3xl font-medium">{plan.price}</span>
                  <span className={plan.highlighted ? "text-[#9B9A8E]" : "text-[#6B6A61]"}>/mo</span>
                </p>
                <p className={`mt-2 text-sm ${plan.highlighted ? "text-[#C9C7BC]" : "text-[#6B6A61]"}`}>{plan.blurb}</p>
                <div className={`mt-5 space-y-1.5 border-t pt-4 ${plan.highlighted ? "border-white/10" : "border-[#EFEAE0]"}`}>
                  <p className="text-sm font-semibold">{plan.limit}</p>
                  <p className={`text-sm ${plan.highlighted ? "text-[#9B9A8E]" : "text-[#8A8A7E]"}`}>{plan.support}</p>
                </div>
                <Link
                  href="/signup"
                  className={`mt-6 inline-flex items-center justify-center rounded-md py-2.5 text-sm font-semibold transition ${
                    plan.highlighted ? "bg-[#4E9C74] text-[#0E100C] hover:bg-[#6FB98F]" : "bg-[#1F6B45] text-white hover:bg-[#195939]"
                  }`}
                >
                  Start 7-day trial
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-[#E5E0D2] bg-white py-20">
        <div className="mx-auto max-w-3xl px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1F6B45]">FAQ</p>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-medium text-[#1B1B16] md:text-4xl">
            Answers for buyers and admins
          </h2>
          <div className="mt-10 space-y-3">
            {faqs.map((item) => (
              <details
                key={item.question}
                className="group rounded-2xl border border-[#E5E0D2] bg-white px-6 py-5 transition hover:border-[#1F6B45]/30 hover:shadow-sm open:border-[#1F6B45]/30 open:shadow-sm"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                  <span className="font-[family-name:var(--font-display)] text-base font-medium text-[#1B1B16]">{item.question}</span>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#EDF2EC] text-[#1F6B45] transition group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-[15px] leading-relaxed text-[#6B6A61]">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA - bookends the hero with the same dark panel + grid texture */}
      <section className="relative overflow-hidden bg-[#12140F] py-20">
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={GRID_TEXTURE} />
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-medium text-[#F5F3EE] md:text-4xl">
            Your next inspection is already on the calendar.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[#C9C7BC]">
            Give CertiWatch a week to watch your first folder or drive. You'll know exactly who's expiring — and
            when — before anyone asks.
          </p>
          {hasSession ? (
            <Link
              href="/analytics"
              className="mt-8 inline-flex items-center justify-center rounded-md bg-[#1F6B45] px-7 py-3 text-sm font-semibold text-white transition hover:bg-[#195939]"
            >
              Go to dashboard
            </Link>
          ) : (
            <Link
              href="/signup"
              className="mt-8 inline-flex items-center justify-center rounded-md bg-[#1F6B45] px-7 py-3 text-sm font-semibold text-white transition hover:bg-[#195939]"
            >
              Start 7-day trial
            </Link>
          )}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
