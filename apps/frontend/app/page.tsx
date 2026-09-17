"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Sora, Manrope, IBM_Plex_Mono } from "next/font/google";

// This page intentionally does not use the shared SiteHeader/SiteFooter or lib/fonts - it commits
// to its own visual language and stays scoped to this one route so /login and /signup are
// unaffected. Visual system: a clean modern SaaS surface (soft neutral bg, one confident accent),
// with the hero and a mid-page spotlight built as faithful recreations of the actual product
// screens (Compliance Matrix, Staff Directory) rather than generic stock "document" art - that's
// what makes it read as a real, premium product instead of a templated marketing page.
const display = Sora({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-display" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-mono" });
const body = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-body" });

const steps = [
  {
    n: "01",
    title: "Enroll",
    description: "Register a device agent, or connect Google Drive or Microsoft OneDrive with a short-lived code — no shared passwords, ever."
  },
  {
    n: "02",
    title: "Ingest",
    description: "New documents land from a watched folder, a connected drive, or a no-login upload link you can send to anyone."
  },
  {
    n: "03",
    title: "Extract & review",
    description: "OCR reads who it's for, the issuer, and the dates. Anything uncertain is held in a review queue instead of guessed at."
  },
  {
    n: "04",
    title: "Track & remind",
    description: "The record lands on the right person's row in the compliance matrix, and reminders go out before it becomes a problem."
  }
];

const features = [
  {
    icon: "grid" as const,
    title: "A live compliance matrix, not a spreadsheet",
    description:
      "Every active staff member against every requirement, recalculated the moment anything changes. Filter to who's expiring, export a CSV, or print an audit-ready report in one click."
  },
  {
    icon: "inbox" as const,
    title: "One inbox for every certificate and licence",
    description:
      "A watched folder, Google Drive, OneDrive, or a no-login upload link you send to anyone — it all lands in the same review queue."
  },
  {
    icon: "sliders" as const,
    title: "A rule engine that knows your exceptions",
    description: "Global defaults per document type, overridden per tenant — not a flat 12-month guess for something that genuinely varies."
  },
  {
    icon: "loupe" as const,
    title: "Nothing goes in unreviewed",
    description: "Low-confidence extractions land in a review queue instead of being silently accepted or dropped."
  },
  {
    icon: "bell" as const,
    title: "Reminders that actually fire",
    description: "A weekly digest plus expiry alerts, sent before the renewal window closes — not after."
  },
  {
    icon: "lock" as const,
    title: "Access scoped to the job",
    description: "Admins see everything, managers see their team, viewers see their own record — set once, enforced everywhere."
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
    question: "Can I change rules later?",
    answer:
      "Yes. Set global defaults per document type, then override per tenant. Compliance status is calculated fresh every time the matrix loads, so a rule change applies to every existing record immediately — no reprocessing to wait on."
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

// The only thing that actually differs by plan on the backend is how many records count toward
// your allowance (see PlanLimits.GetRecordLimitAsync) - there's no code-level gating on ingestion
// channels, retention, or an API that doesn't exist. So the tiers are honest about that: same
// platform on every plan, priced by how much you're tracking - not three different feature lists
// invented to make three columns look different.
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
    limit: "50 records / month",
    support: "Standard support",
    cta: "Start 7-day trial"
  },
  {
    name: "Growth",
    price: "$249",
    blurb: "For growing orgs juggling certs, licenses, and insurance.",
    limit: "500 records / month",
    support: "Standard support",
    cta: "Start 7-day trial",
    highlighted: true
  },
  {
    name: "Pro",
    price: "$499",
    blurb: "For ops teams tracking everything that could lapse.",
    limit: "Unlimited records",
    support: "Priority support",
    cta: "Start 7-day trial"
  }
];

const industries = ["Care homes", "Construction", "Hospitality", "Facilities"];

// Both the hero and the mid-page spotlight recreate real screens (see /compliance and /staff)
// with the same status-pill vocabulary the actual app uses, instead of generic stock "document"
// or "checklist" art - the product itself is the visual, not an illustration of it.
type Status = "compliant" | "expiring" | "expired" | "missing";
const heroRows: { name: string; role: string; firstAid: Status; dbs: Status }[] = [
  { name: "Jordan Diaz", role: "Senior Carer", firstAid: "compliant", dbs: "compliant" },
  { name: "Sam Whitlock", role: "Carer", firstAid: "expiring", dbs: "compliant" },
  { name: "Priya Nair", role: "Support Worker", firstAid: "expired", dbs: "missing" }
];
const staffRows: { name: string; role: string; approved: number; expired: number }[] = [
  { name: "Jordan Diaz", role: "Senior Carer", approved: 6, expired: 0 },
  { name: "Sam Whitlock", role: "Carer", approved: 4, expired: 1 },
  { name: "Priya Nair", role: "Support Worker", approved: 3, expired: 2 },
  { name: "Morgan Reyes", role: "Carer", approved: 5, expired: 0 }
];

export default function LandingPage() {
  const [hasSession, setHasSession] = useState(false);
  const year = new Date().getFullYear();

  useEffect(() => {
    setHasSession(document.cookie.includes("cw_session="));
  }, []);

  return (
    <div
      className={`${display.variable} ${mono.variable} ${body.variable} font-[family-name:var(--font-body)] bg-[#F6F7F9] text-[#0E1420] antialiased`}
    >
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-[#E3E7EC] bg-[#F6F7F9]/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <Logomark />
            <span className="font-[family-name:var(--font-display)] text-base font-bold tracking-tight">CertiWatch</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-[#5B6472] md:flex">
            <Link href="#features" className="hover:text-[#0E1420]">Features</Link>
            <Link href="#how" className="hover:text-[#0E1420]">How it works</Link>
            <Link href="#pricing" className="hover:text-[#0E1420]">Pricing</Link>
            <Link href="#faq" className="hover:text-[#0E1420]">FAQ</Link>
          </nav>
          <div className="flex items-center gap-3">
            {hasSession ? (
              <Link
                href="/analytics"
                className="rounded-full bg-[#0E7C66] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0A5F4E]"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="hidden text-sm font-medium text-[#5B6472] hover:text-[#0E1420] md:inline">
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-full bg-[#0E7C66] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0A5F4E]"
                >
                  Start trial
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 right-[-10%] h-[520px] w-[520px] rounded-full opacity-[0.16] blur-3xl"
          style={{ background: "radial-gradient(circle, #0E7C66 0%, transparent 70%)" }}
        />
        <div className="relative mx-auto grid max-w-6xl gap-16 px-6 py-16 md:grid-cols-[1.05fr_0.95fr] md:items-center md:py-24">
          <div className="animate-fade-in-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#E3E7EC] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#5B6472] shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-[#0E7C66]" />
              Built for care, construction &amp; hospitality teams
            </span>
            <h1 className="mt-5 max-w-xl font-[family-name:var(--font-display)] text-[2.6rem] font-bold leading-[1.08] tracking-tight md:text-[3.4rem]">
              Stop finding out something's expired <span className="text-[#D0453A]">after</span> the inspector does.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-[#5B6472]">
              CertiWatch watches every folder and cloud drive your staff certificates, licenses, and inspection
              documents land in, reads the expiry off the page, matches it to the right person, and tells you —
              and only you — before it runs out.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              {hasSession ? (
                <Link
                  href="/analytics"
                  className="inline-flex items-center justify-center rounded-full bg-[#0E7C66] px-7 py-3.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(14,124,102,0.6)] transition hover:bg-[#0A5F4E]"
                >
                  Go to dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/signup"
                    className="inline-flex items-center justify-center rounded-full bg-[#0E7C66] px-7 py-3.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(14,124,102,0.6)] transition hover:bg-[#0A5F4E]"
                  >
                    Start 7-day trial
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center rounded-full border border-[#D7DCE3] bg-white px-7 py-3.5 text-sm font-semibold text-[#0E1420] transition hover:border-[#0E1420]"
                  >
                    Log in
                  </Link>
                </>
              )}
            </div>
            <p className="mt-6 text-sm text-[#94A0AF]">
              7-day free trial · Card required upfront · Cancel anytime before billing starts
            </p>
          </div>

          {/* Hero visual - a faithful recreation of the real Compliance Matrix screen */}
          <div className="relative mx-auto w-full max-w-md animate-fade-in-up" style={{ animationDelay: "120ms" }}>
            <AppWindow title="app.certiwatch.com/compliance">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-[family-name:var(--font-display)] text-base font-bold">Hull House</p>
                  <p className="text-xs text-[#94A0AF]">42 staff tracked · 91% compliant</p>
                </div>
                <span className="rounded-full bg-[#FBE9E7] px-2.5 py-1 text-[11px] font-semibold text-[#B3352B]">2 need attention</span>
              </div>
              <table className="mt-5 w-full text-left text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-[#94A0AF]">
                    <th className="pb-2 font-medium">Staff</th>
                    <th className="pb-2 font-medium">First aid</th>
                    <th className="pb-2 font-medium">DBS check</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF0F3]">
                  {heroRows.map((row) => (
                    <tr key={row.name}>
                      <td className="py-2.5 pr-2">
                        <p className="font-semibold text-[#0E1420]">{row.name}</p>
                        <p className="text-xs text-[#94A0AF]">{row.role}</p>
                      </td>
                      <td className="py-2.5">
                        <StatusPill status={row.firstAid} />
                      </td>
                      <td className="py-2.5">
                        <StatusPill status={row.dbs} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AppWindow>
            <div className="absolute -bottom-5 -left-5 hidden items-center gap-2 rounded-xl border border-[#E3E7EC] bg-white px-3.5 py-2.5 shadow-[0_12px_32px_-12px_rgba(14,20,32,0.35)] sm:flex">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E4F5F0] text-[#0A5F4E]">
                <BellIcon className="h-3.5 w-3.5" />
              </span>
              <div className="leading-tight">
                <p className="text-xs font-semibold text-[#0E1420]">Reminder sent</p>
                <p className="text-[11px] text-[#94A0AF]">Priya's DBS check</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-y border-[#E3E7EC] bg-white py-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 text-center md:flex-row md:justify-between md:text-left">
          <p className="text-sm font-medium text-[#94A0AF]">Built for teams that can't afford to guess</p>
          <div className="flex flex-wrap justify-center gap-2">
            {industries.map((tag) => (
              <span key={tag} className="rounded-full bg-[#F1F3F6] px-3.5 py-1.5 text-xs font-semibold text-[#5B6472]">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#0E7C66]">What you get</span>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight md:text-4xl">
              Everything between a scanned document and a peaceful audit.
            </h2>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl border border-[#E3E7EC] bg-white p-6 transition duration-200 hover:-translate-y-1 hover:border-transparent hover:shadow-[0_20px_40px_-16px_rgba(14,20,32,0.18)]"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E4F5F0] text-[#0A5F4E] transition group-hover:bg-[#0E7C66] group-hover:text-white">
                  <FeatureIcon name={feature.icon} className="h-5 w-5" />
                </span>
                <h3 className="mt-5 font-[family-name:var(--font-display)] text-lg font-bold tracking-tight">{feature.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-[#5B6472]">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Product spotlight - a second real screen, so the page reads as "here's the actual
          product" rather than icon cards describing something you can't see. */}
      <section className="border-y border-[#E3E7EC] bg-white py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 md:grid-cols-2">
          <div>
            <span className="inline-flex items-center rounded-full bg-[#E4F5F0] px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] text-[#0A5F4E]">
              Staff directory
            </span>
            <h2 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight md:text-4xl">
              Every certificate, matched to a name.
            </h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[#5B6472]">
              Add staff by hand or import a CSV in seconds. Every accepted document is matched to the person it
              belongs to, so approved and expired counts sit right next to their name — click either one to see
              exactly which record needs attention.
            </p>
            <ul className="mt-6 space-y-3">
              {["CSV import with per-row error reporting", "Active/inactive status without losing history", "One click from a name straight to their records"].map(
                (item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-[#0E1420]">
                    <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#0E7C66]" />
                    {item}
                  </li>
                )
              )}
            </ul>
          </div>
          <AppWindow title="app.certiwatch.com/staff">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-[#94A0AF]">
                  <th className="pb-2 font-medium">Staff</th>
                  <th className="pb-2 text-center font-medium">Approved</th>
                  <th className="pb-2 text-center font-medium">Expired</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF0F3]">
                {staffRows.map((row) => (
                  <tr key={row.name}>
                    <td className="py-2.5 pr-2">
                      <p className="font-semibold text-[#0E1420]">{row.name}</p>
                      <p className="text-xs text-[#94A0AF]">{row.role}</p>
                    </td>
                    <td className="py-2.5 text-center">
                      <span className="inline-flex min-w-[1.75rem] justify-center rounded-full bg-[#E4F5F0] px-2 py-1 text-xs font-bold text-[#0A5F4E]">
                        {row.approved}
                      </span>
                    </td>
                    <td className="py-2.5 text-center">
                      <span
                        className={`inline-flex min-w-[1.75rem] justify-center rounded-full px-2 py-1 text-xs font-bold ${
                          row.expired > 0 ? "bg-[#FBE9E7] text-[#B3352B]" : "bg-[#F1F3F6] text-[#94A0AF]"
                        }`}
                      >
                        {row.expired}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AppWindow>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#0E7C66]">How it works</span>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight md:text-4xl">
              Four steps, and none of them are "chase someone over email."
            </h2>
          </div>
          <div className="relative mt-16">
            <div className="absolute left-5 top-5 bottom-5 w-px bg-[#E3E7EC] md:left-0 md:right-0 md:top-5 md:bottom-auto md:h-px md:w-auto" />
            <div className="grid gap-10 md:grid-cols-4">
              {steps.map((step) => (
                <div key={step.n} className="relative flex gap-4 md:flex-col md:gap-4">
                  <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0E7C66] font-[family-name:var(--font-mono)] text-xs font-bold text-white">
                    {step.n}
                  </span>
                  <div className="pt-1 md:pt-0">
                    <h3 className="font-[family-name:var(--font-display)] text-base font-bold tracking-tight">{step.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-[#5B6472]">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-y border-[#E3E7EC] bg-white py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#0E7C66]">Pricing</span>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight md:text-4xl">
              One platform, priced by how much you're tracking.
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-[#5B6472]">
              Every plan below runs the exact same product — the compliance matrix, both cloud connectors, custom
              rules, reminders, the lot. The only thing that changes is your monthly record allowance.
            </p>
          </div>

          {/* What's included everywhere - stated once so the three cards below aren't three
              invented feature lists pretending the tiers differ on capability. */}
          <ul className="mt-8 grid gap-x-8 gap-y-3 rounded-2xl border border-[#E3E7EC] bg-[#FAFBFC] p-6 sm:grid-cols-2 lg:grid-cols-3">
            {sharedFeatures.map((feat) => (
              <li key={feat} className="flex items-start gap-2.5 text-sm text-[#0E1420]">
                <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#0E7C66]" />
                {feat}
              </li>
            ))}
          </ul>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative flex flex-col rounded-2xl border p-7 transition duration-200 ${
                  plan.highlighted
                    ? "border-[#0E7C66] bg-white shadow-[0_24px_48px_-16px_rgba(14,124,102,0.35)] md:-translate-y-2"
                    : "border-[#E3E7EC] bg-white hover:-translate-y-1 hover:shadow-[0_20px_40px_-16px_rgba(14,20,32,0.16)]"
                }`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-[#0E7C66] px-3.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm">
                    Most popular
                  </span>
                )}
                <p className="text-sm font-semibold text-[#5B6472]">{plan.name}</p>
                <p className="mt-2 flex items-baseline gap-1">
                  <span className="font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight">{plan.price}</span>
                  <span className="text-[#94A0AF]">/mo</span>
                </p>
                <p className="mt-3 text-sm text-[#5B6472]">{plan.blurb}</p>
                <div className="mt-6 space-y-1.5 border-t border-[#EEF0F3] pt-5">
                  <p className="text-sm font-bold text-[#0E1420]">{plan.limit}</p>
                  <p className="text-sm text-[#94A0AF]">{plan.support}</p>
                </div>
                <Link
                  href="/signup"
                  className={`mt-8 inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition ${
                    plan.highlighted
                      ? "bg-[#0E7C66] text-white hover:bg-[#0A5F4E]"
                      : "border border-[#D7DCE3] text-[#0E1420] hover:border-[#0E1420]"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24">
        <div className="mx-auto max-w-3xl px-6">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#0E7C66]">FAQ</span>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight md:text-4xl">
            Answers for buyers and admins
          </h2>
          <div className="mt-10 space-y-3">
            {faqs.map((item) => (
              <details key={item.question} className="group rounded-2xl border border-[#E3E7EC] bg-white px-6 py-5 open:shadow-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                  <span className="font-[family-name:var(--font-display)] text-base font-bold tracking-tight">{item.question}</span>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F1F3F6] text-[#5B6472] transition group-open:rotate-45">
                    <PlusIcon className="h-3 w-3" />
                  </span>
                </summary>
                <p className="mt-3 text-[15px] leading-relaxed text-[#5B6472]">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-[#0E1420] py-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-white md:text-4xl">
            Your next inspection is already on the calendar.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[#9AA5B4]">
            Give CertiWatch a week to watch your first folder or drive. You'll know exactly who's expiring — and
            when — before anyone asks.
          </p>
          {hasSession ? (
            <Link
              href="/analytics"
              className="mt-8 inline-flex items-center justify-center rounded-full bg-[#0E7C66] px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-[#12996F]"
            >
              Go to dashboard
            </Link>
          ) : (
            <Link
              href="/signup"
              className="mt-8 inline-flex items-center justify-center rounded-full bg-[#0E7C66] px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-[#12996F]"
            >
              Start 7-day trial
            </Link>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-[#F6F7F9] py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-2.5">
            <Logomark />
            <div>
              <p className="font-[family-name:var(--font-display)] text-sm font-bold">CertiWatch</p>
              <p className="mt-1 max-w-sm text-sm text-[#5B6472]">
                Compliance-grade renewal tracking for SMB teams — certificates, licenses, insurance &amp; more.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-5 text-sm">
            <Link href="mailto:hello@certiwatch.com" className="text-[#5B6472] hover:text-[#0E1420]">
              hello@certiwatch.com
            </Link>
            {hasSession ? (
              <Link href="/analytics" className="font-semibold text-[#0E7C66] hover:text-[#0A5F4E]">
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/signup" className="font-semibold text-[#0E7C66] hover:text-[#0A5F4E]">
                  Start trial
                </Link>
                <Link href="/login" className="text-[#5B6472] hover:text-[#0E1420]">
                  Log in
                </Link>
              </>
            )}
          </div>
        </div>
        <div className="mx-auto mt-8 max-w-6xl border-t border-[#E3E7EC] px-6 pt-6">
          <p className="text-xs text-[#94A0AF]">© {year} CertiWatch. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function Logomark() {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0E7C66] text-white">
      <CheckIcon className="h-4 w-4" strokeWidth={2.4} />
    </span>
  );
}

// A window chrome (dots + address bar) around a real recreation of an actual CertiWatch screen -
// this is what makes the marketing page look like a screenshot of the product instead of an
// illustration standing in for it.
function AppWindow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E3E7EC] bg-white shadow-[0_30px_70px_-20px_rgba(14,20,32,0.28)]">
      <div className="flex items-center gap-2 border-b border-[#E3E7EC] bg-[#FAFBFC] px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[#E3E7EC]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#E3E7EC]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#E3E7EC]" />
        <span className="ml-3 truncate rounded-md border border-[#E3E7EC] bg-white px-2.5 py-1 font-[family-name:var(--font-mono)] text-[10px] text-[#94A0AF]">
          {title}
        </span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  const styles: Record<Status, string> = {
    compliant: "bg-[#E4F5F0] text-[#0A5F4E]",
    expiring: "bg-[#FCF3DC] text-[#8A6111]",
    expired: "bg-[#FBE9E7] text-[#B3352B]",
    missing: "bg-[#F1F3F6] text-[#94A0AF]"
  };
  const labels: Record<Status, string> = {
    compliant: "Compliant",
    expiring: "Expiring",
    expired: "Expired",
    missing: "Missing"
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${styles[status]}`}>{labels[status]}</span>;
}

// Bespoke line-art matching the page's own stroke language - not a generic icon-library set.
type FeatureIconName = "grid" | "inbox" | "sliders" | "loupe" | "bell" | "lock";
function FeatureIcon({ name, className }: { name: FeatureIconName; className?: string }) {
  const common = { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "grid":
      return (
        <svg {...common}>
          <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
          <path d="M3.5 9.5h17M3.5 15.5h17M9.5 3.5v17M15.5 3.5v17" />
        </svg>
      );
    case "inbox":
      return (
        <svg {...common}>
          <path d="M3.5 13.5h4.8l1.4 2.2h4.6l1.4-2.2h4.8" />
          <path d="M5.2 13.5 7 5.5h10l1.8 8" />
        </svg>
      );
    case "sliders":
      return (
        <svg {...common}>
          <path d="M4 6h9M17 6h3M4 12h4M12 12h8M4 18h9M17 18h3" />
          <circle cx="14.5" cy="6" r="1.6" fill="currentColor" stroke="none" />
          <circle cx="8" cy="12" r="1.6" fill="currentColor" stroke="none" />
          <circle cx="14.5" cy="18" r="1.6" fill="currentColor" stroke="none" />
        </svg>
      );
    case "loupe":
      return (
        <svg {...common}>
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m20 20-4.4-4.4M8 10.5l1.8 1.8L13.5 8" />
        </svg>
      );
    case "bell":
      return <BellIcon className={className} />;
    case "lock":
      return (
        <svg {...common}>
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
        </svg>
      );
  }
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 17v-5.5a6 6 0 0 1 12 0V17l1.8 2.2H4.2Z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}

function CheckIcon({ className, strokeWidth = 2 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
