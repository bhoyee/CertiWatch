"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Zilla_Slab, Courier_Prime, IBM_Plex_Sans } from "next/font/google";

// This page intentionally does not use the shared SiteHeader/SiteFooter or lib/fonts - it commits
// to its own visual language (a compliance ledger/document, not another dark-hero SaaS template)
// and stays scoped to this one route so /login and /signup are unaffected.
const display = Zilla_Slab({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-display" });
const mono = Courier_Prime({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-mono" });
const body = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body" });

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
    title: "A live compliance matrix, not a spreadsheet",
    description:
      "Every active staff member against every requirement, recalculated the moment anything changes. Filter to who's expiring, export a CSV, or print an audit-ready report in one click."
  },
  {
    title: "One inbox for every certificate and licence",
    description:
      "A watched folder, Google Drive, OneDrive, or a no-login upload link you send to anyone — it all lands in the same review queue."
  },
  {
    title: "A rule engine that knows your exceptions",
    description: "Global defaults per document type, overridden per tenant — not a flat 12-month guess for something that genuinely varies."
  },
  {
    title: "Nothing goes in unreviewed",
    description: "Low-confidence extractions land in a review queue instead of being silently accepted or dropped."
  },
  {
    title: "Reminders that actually fire",
    description: "A weekly digest plus expiry alerts, sent before the renewal window closes — not after."
  },
  {
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

// Grounds the hero visual in the actual Compliance Matrix screen (see /compliance) rather than a
// generic single-certificate mockup — this is the feature that's genuinely distinctive about the
// product, so the hero should look like it, not like stock "document" imagery.
type LedgerStatus = "ok" | "expiring" | "expired" | "missing";
const ledgerRows: { name: string; firstAid: LedgerStatus; dbs: LedgerStatus }[] = [
  { name: "Jordan Diaz", firstAid: "ok", dbs: "ok" },
  { name: "Sam Whitlock", firstAid: "expiring", dbs: "ok" },
  { name: "Priya Nair", firstAid: "expired", dbs: "missing" }
];

export default function LandingPage() {
  const [hasSession, setHasSession] = useState(false);
  const year = new Date().getFullYear();

  useEffect(() => {
    setHasSession(document.cookie.includes("cw_session="));
  }, []);

  return (
    <div
      className={`${display.variable} ${mono.variable} ${body.variable} font-[family-name:var(--font-body)] bg-[#FAFAF6] text-[#16140F]`}
    >
      {/* Masthead */}
      <header className="border-b border-[#16140F] bg-[#FAFAF6]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-[0.15em]">
            CertiWatch <span className="hidden text-[#57534A] sm:inline">/ Compliance Register</span>
          </Link>
          <nav className="hidden items-center gap-8 font-[family-name:var(--font-mono)] text-xs uppercase tracking-wide text-[#57534A] md:flex">
            <Link href="#features" className="hover:text-[#16140F]">Features</Link>
            <Link href="#how" className="hover:text-[#16140F]">How it works</Link>
            <Link href="#pricing" className="hover:text-[#16140F]">Pricing</Link>
            <Link href="#faq" className="hover:text-[#16140F]">FAQ</Link>
            <Link href="#contact" className="hover:text-[#16140F]">Contact</Link>
          </nav>
          <div className="flex items-center gap-4">
            {hasSession ? (
              <Link
                href="/analytics"
                className="border border-[#16140F] px-4 py-2 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-wide transition hover:bg-[#16140F] hover:text-[#FAFAF6]"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden font-[family-name:var(--font-mono)] text-xs uppercase tracking-wide text-[#57534A] hover:text-[#16140F] md:inline"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="border border-[#16140F] bg-[#16140F] px-4 py-2 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-wide text-[#FAFAF6] transition hover:bg-[#1E3A5F] hover:border-[#1E3A5F]"
                >
                  Start trial
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-[#16140F]">
        <div className="mx-auto grid max-w-6xl gap-16 px-6 py-16 md:grid-cols-[1.1fr_0.9fr] md:items-center md:py-24">
          <div className="animate-fade-in-up">
            <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.2em] text-[#57534A]">
              §1 — Every renewal, handled
            </p>
            <h1 className="mt-4 max-w-xl font-[family-name:var(--font-display)] text-4xl font-bold leading-[1.05] md:text-[3.4rem]">
              Stop finding out something's expired <span className="text-[#B3271E]">after</span> the inspector does.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-[#3F3D35]">
              CertiWatch watches every folder and cloud drive your staff certificates, licenses, and inspection
              documents land in, reads the expiry off the page, matches it to the right person, and tells you —
              and only you — before it runs out.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              {hasSession ? (
                <Link
                  href="/analytics"
                  className="inline-flex items-center justify-center border-2 border-[#16140F] bg-[#16140F] px-6 py-3 font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-wide text-[#FAFAF6] transition hover:bg-[#1E3A5F] hover:border-[#1E3A5F]"
                >
                  Go to dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/signup"
                    className="inline-flex items-center justify-center border-2 border-[#16140F] bg-[#16140F] px-6 py-3 font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-wide text-[#FAFAF6] transition hover:bg-[#1E3A5F] hover:border-[#1E3A5F]"
                  >
                    Start 7-day trial
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center border-2 border-[#16140F] px-6 py-3 font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-wide text-[#16140F] transition hover:bg-[#16140F] hover:text-[#FAFAF6]"
                  >
                    Log in
                  </Link>
                </>
              )}
            </div>
            <p className="mt-8 font-[family-name:var(--font-mono)] text-xs uppercase tracking-wide text-[#8A887C]">
              7-day free trial · Card required upfront · Cancel anytime before billing starts
            </p>
          </div>

          {/* Compliance ledger visual - a miniature of the real Compliance Matrix screen */}
          <div className="relative mx-auto w-full max-w-sm animate-fade-in-up" style={{ animationDelay: "120ms" }}>
            <div className="relative border-2 border-[#16140F] bg-white p-7">
              <div className="pointer-events-none absolute inset-[6px] border border-[#16140F]/25" />
              <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[#8A887C]">
                Ref. CW-2026-0412 · Compliance Ledger
              </p>
              <h3 className="mt-3 font-[family-name:var(--font-display)] text-xl font-bold">Hull House — this week</h3>
              <table className="mt-5 w-full border-collapse border-t border-[#16140F]/15 pt-1 font-[family-name:var(--font-mono)] text-[11px]">
                <thead>
                  <tr>
                    <th className="pb-2 pt-4 text-left font-normal uppercase tracking-wide text-[#8A887C]">Staff</th>
                    <th className="pb-2 pt-4 text-center font-normal uppercase tracking-wide text-[#8A887C]">First aid</th>
                    <th className="pb-2 pt-4 text-center font-normal uppercase tracking-wide text-[#8A887C]">DBS</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerRows.map((row) => (
                    <tr key={row.name} className="border-t border-[#16140F]/10">
                      <td className="py-2 text-left">{row.name}</td>
                      <td className="py-2 text-center">
                        <LedgerMark status={row.firstAid} />
                      </td>
                      <td className="py-2 text-center">
                        <LedgerMark status={row.dbs} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-5 flex items-baseline justify-between border-t border-[#16140F]/15 pt-4 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wide text-[#8A887C]">
                <span>42 staff tracked</span>
                <span>91% compliant</span>
              </div>
            </div>
            <div className="absolute -right-7 -top-7 flex h-28 w-28 rotate-[-14deg] items-center justify-center rounded-full border-[3px] border-double border-[#B3271E] bg-[#FAFAF6] mix-blend-multiply">
              <span className="text-center font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase leading-[1.35] tracking-wide text-[#B3271E]">
                2 gaps
                <br />
                to clear
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-b border-[#16140F] bg-white py-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 text-center md:flex-row md:justify-between md:text-left">
          <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-wide text-[#57534A]">
            Built for teams that can't afford to guess
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {industries.map((tag) => (
              <span
                key={tag}
                className="border border-[#16140F]/30 px-3 py-1 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wide"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-b border-[#16140F] bg-[#FAFAF6] py-20">
        <div className="mx-auto max-w-5xl px-6">
          <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.2em] text-[#57534A]">§2 — What you get</p>
          <h2 className="mt-3 max-w-2xl font-[family-name:var(--font-display)] text-3xl font-bold md:text-4xl">
            Everything between a scanned document and a peaceful audit.
          </h2>
          <div className="mt-10 border border-[#16140F]">
            {features.map((feature, i) => (
              <div
                key={feature.title}
                className={`grid gap-2 px-6 py-6 sm:grid-cols-[3rem_1fr] sm:gap-8 sm:px-8 ${i !== 0 ? "border-t border-[#16140F]/20" : ""}`}
              >
                <span className="font-[family-name:var(--font-mono)] text-xs text-[#8A887C]">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="font-[family-name:var(--font-display)] text-lg font-bold">{feature.title}</h3>
                  <p className="mt-1.5 max-w-xl text-[15px] leading-relaxed text-[#57534A]">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-b border-[#16140F] bg-white py-20">
        <div className="mx-auto max-w-5xl px-6">
          <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.2em] text-[#57534A]">§3 — How it works</p>
          <h2 className="mt-3 max-w-2xl font-[family-name:var(--font-display)] text-3xl font-bold md:text-4xl">
            Four steps, and none of them are "chase someone over email."
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {steps.map((step) => (
              <div key={step.n} className="flex gap-4 border border-[#16140F] p-6">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-[#16140F] font-[family-name:var(--font-mono)] text-xs font-bold">
                  {step.n}
                </span>
                <div>
                  <h3 className="font-[family-name:var(--font-display)] text-base font-bold">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#57534A]">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-b border-[#16140F] bg-[#FAFAF6] py-20">
        <div className="mx-auto max-w-5xl px-6">
          <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.2em] text-[#57534A]">§4 — Pricing</p>
          <h2 className="mt-3 max-w-2xl font-[family-name:var(--font-display)] text-3xl font-bold md:text-4xl">
            One platform, priced by how much you're tracking.
          </h2>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[#57534A]">
            Every plan below runs the exact same product — the compliance matrix, both cloud connectors, custom rules,
            reminders, the lot. The only thing that changes is your monthly record allowance.
          </p>

          {/* What's included everywhere - stated once so the three cards below aren't three
              invented feature lists pretending the tiers differ on capability. */}
          <ul className="mt-8 grid gap-x-8 gap-y-2.5 border border-[#16140F] bg-white p-6 sm:grid-cols-2 md:grid-cols-3">
            {sharedFeatures.map((feat) => (
              <li key={feat} className="flex items-start gap-2.5 font-[family-name:var(--font-mono)] text-xs">
                <span className="text-[#B3271E]">·</span>
                <span className="text-[#3F3D35]">{feat}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 grid border border-[#16140F] md:grid-cols-3">
            {plans.map((plan, i) => (
              <div
                key={plan.name}
                className={`flex flex-col p-7 ${i !== 0 ? "border-t border-[#16140F] md:border-t-0 md:border-l" : ""} ${
                  plan.highlighted ? "bg-[#16140F] text-[#FAFAF6]" : "bg-white"
                }`}
              >
                {plan.highlighted && (
                  <span className="mb-4 inline-flex w-fit items-center border border-[#FAFAF6]/40 px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-wide text-[#FAFAF6]">
                    Most popular
                  </span>
                )}
                <p className={`font-[family-name:var(--font-mono)] text-xs uppercase tracking-wide ${plan.highlighted ? "text-[#B7C6D8]" : "text-[#57534A]"}`}>
                  {plan.name}
                </p>
                <p className="mt-2 flex items-baseline gap-1">
                  <span className="font-[family-name:var(--font-display)] text-4xl font-bold">{plan.price}</span>
                  <span className={plan.highlighted ? "text-[#B7C6D8]" : "text-[#57534A]"}>/mo</span>
                </p>
                <p className={`mt-3 text-sm ${plan.highlighted ? "text-[#D7DEE7]" : "text-[#57534A]"}`}>{plan.blurb}</p>
                <div className={`mt-6 space-y-2 border-t pt-4 font-[family-name:var(--font-mono)] text-xs ${plan.highlighted ? "border-[#FAFAF6]/20" : "border-[#16140F]/15"}`}>
                  <p className={`text-sm font-bold ${plan.highlighted ? "text-[#FAFAF6]" : "text-[#16140F]"}`}>{plan.limit}</p>
                  <p className={plan.highlighted ? "text-[#B7C6D8]" : "text-[#8A887C]"}>{plan.support}</p>
                </div>
                <Link
                  href="/signup"
                  className={`mt-8 inline-flex items-center justify-center border-2 px-4 py-3 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-wide transition ${
                    plan.highlighted
                      ? "border-[#FAFAF6] bg-[#FAFAF6] text-[#16140F] hover:bg-transparent hover:text-[#FAFAF6]"
                      : "border-[#16140F] text-[#16140F] hover:bg-[#16140F] hover:text-[#FAFAF6]"
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
      <section id="faq" className="border-b border-[#16140F] bg-white py-20">
        <div className="mx-auto max-w-3xl px-6">
          <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.2em] text-[#57534A]">§5 — FAQ</p>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-bold md:text-4xl">Answers for buyers and admins</h2>
          <div className="mt-10 border border-[#16140F]">
            {faqs.map((item, i) => (
              <details key={item.question} className={`group px-6 py-5 ${i !== 0 ? "border-t border-[#16140F]/20" : ""}`}>
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
                  <span className="flex items-baseline gap-4">
                    <span className="font-[family-name:var(--font-mono)] text-xs text-[#8A887C]">Q{String(i + 1).padStart(2, "0")}</span>
                    <span className="font-[family-name:var(--font-display)] text-base font-bold">{item.question}</span>
                  </span>
                  <span className="shrink-0 font-[family-name:var(--font-mono)] text-[#8A887C] transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 pl-[3.1rem] text-[15px] leading-relaxed text-[#57534A]">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-[#1E3A5F] py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.2em] text-[#8FA8C7]">§6 — Get started</p>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-bold text-[#FAFAF6] md:text-4xl">
            Your next inspection is already on the calendar.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[#C3D2E3]">
            Give CertiWatch a week to watch your first folder or drive. You'll know exactly who's expiring — and when — before anyone asks.
          </p>
          {hasSession ? (
            <Link
              href="/analytics"
              className="mt-8 inline-flex items-center justify-center border-2 border-[#FAFAF6] bg-[#FAFAF6] px-7 py-3 font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-wide text-[#1E3A5F] transition hover:bg-transparent hover:text-[#FAFAF6]"
            >
              Go to dashboard
            </Link>
          ) : (
            <Link
              href="/signup"
              className="mt-8 inline-flex items-center justify-center border-2 border-[#FAFAF6] bg-[#FAFAF6] px-7 py-3 font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-wide text-[#1E3A5F] transition hover:bg-transparent hover:text-[#FAFAF6]"
            >
              Start 7-day trial
            </Link>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-[#FAFAF6] py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-[0.15em]">CertiWatch</p>
            <p className="mt-1 max-w-sm text-sm text-[#57534A]">
              Compliance-grade renewal tracking for SMB teams — certificates, licenses, insurance &amp; more.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-5 font-[family-name:var(--font-mono)] text-xs uppercase tracking-wide">
            <Link href="mailto:hello@certiwatch.com" className="text-[#57534A] hover:text-[#16140F]">
              hello@certiwatch.com
            </Link>
            {hasSession ? (
              <Link href="/analytics" className="font-bold text-[#1E3A5F] hover:text-[#16140F]">
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/signup" className="font-bold text-[#1E3A5F] hover:text-[#16140F]">
                  Start trial
                </Link>
                <Link href="/login" className="text-[#57534A] hover:text-[#16140F]">
                  Log in
                </Link>
              </>
            )}
          </div>
        </div>
        <div className="mx-auto mt-8 max-w-6xl border-t border-[#16140F]/15 px-6 pt-6">
          <p className="font-[family-name:var(--font-mono)] text-[11px] text-[#8A887C]">
            © {year} CertiWatch. Not actually a government form.
          </p>
        </div>
      </footer>
    </div>
  );
}

function LedgerMark({ status }: { status: LedgerStatus }) {
  const marks: Record<LedgerStatus, { glyph: string; className: string }> = {
    ok: { glyph: "✓", className: "text-[#16140F]" },
    expiring: { glyph: "●", className: "text-[#9C6B1D]" },
    expired: { glyph: "✕", className: "text-[#B3271E]" },
    missing: { glyph: "–", className: "text-[#8A887C]" }
  };
  const mark = marks[status];
  return <span className={`font-bold ${mark.className}`}>{mark.glyph}</span>;
}
