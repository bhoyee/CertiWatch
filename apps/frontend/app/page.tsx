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
function IconGrid({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <rect x="4" y="4" width="16" height="16" rx="1.5" />
      <path d="M4 10h16M4 16h16M10 4v16M16 4v16" />
    </svg>
  );
}
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
function IconSliders({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <path d="M4 7h8M16 7h4M4 12h3M11 12h9M4 17h8M16 17h4" strokeLinecap="round" />
      <circle cx="13" cy="7" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="7" cy="12" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="13" cy="17" r="1.7" fill="currentColor" stroke="none" />
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

const features = [
  {
    icon: IconGrid,
    title: "A live compliance matrix, not a spreadsheet",
    description:
      "Every active staff member against every requirement, recalculated the moment anything changes. Filter to who's expiring, export a CSV, or print an audit-ready report in one click."
  },
  {
    icon: IconInbox,
    title: "One inbox for every certificate and licence",
    description:
      "A watched folder, Google Drive, OneDrive, or a no-login upload link you send to anyone — it all lands in the same review queue."
  },
  {
    icon: IconSliders,
    title: "A rule engine that knows your exceptions",
    description: "Global defaults per document type, overridden per tenant — not a flat 12-month guess for something that genuinely varies."
  },
  {
    icon: IconCheckShield,
    title: "Nothing goes in unreviewed",
    description: "Low-confidence extractions land in a review queue instead of being silently accepted or dropped."
  },
  {
    icon: IconBell,
    title: "Reminders that actually fire",
    description: "A weekly digest plus expiry alerts, sent before the renewal window closes — not after."
  },
  {
    icon: IconLock,
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
    support: "Standard support"
  },
  {
    name: "Growth",
    price: "$249",
    blurb: "For growing orgs juggling certs, licenses, and insurance.",
    limit: "500 records / month",
    support: "Standard support",
    highlighted: true
  },
  {
    name: "Pro",
    price: "$499",
    blurb: "For ops teams tracking everything that could lapse.",
    limit: "Unlimited records",
    support: "Priority support"
  }
];

const industries = ["Care homes", "Construction", "Hospitality", "Facilities"];

// The hero visual - a compliance-matrix preview using the same card and colored-pill language
// as the rest of the app (the success/error tones already established on /login and /signup are
// reused directly for "compliant"/"expired", with one new muted amber added for "expiring").
type HeroStatus = "compliant" | "expiring" | "expired";
const heroStatusStyles: Record<HeroStatus, string> = {
  compliant: "bg-[#EDF5EF] text-[#1F6B45]",
  expiring: "bg-[#FBF3DC] text-[#92700E]",
  expired: "bg-[#FBECEA] text-[#B3432B]"
};
const heroStatusLabels: Record<HeroStatus, string> = {
  compliant: "Compliant",
  expiring: "Expiring",
  expired: "Expired"
};
const heroRows: { name: string; role: string; status: HeroStatus }[] = [
  { name: "Jordan Diaz", role: "Senior Carer", status: "compliant" },
  { name: "Sam Whitlock", role: "Carer", status: "expiring" },
  { name: "Priya Nair", role: "Support Worker", status: "expired" }
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

          {/* Hero visual - a compliance-matrix preview in the same card and pill language as
              the rest of the app, floating on the dark panel with a soft green glow instead of
              a decorative illustration unrelated to the actual product. */}
          <div className="relative mx-auto w-full max-w-sm">
            <div aria-hidden="true" className="absolute -inset-8 rounded-[2.5rem] bg-[#4E9C74]/10 blur-3xl" />
            <div className="relative rounded-2xl border border-black/5 bg-[#F5F3EE] p-6 shadow-2xl shadow-black/40">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-[family-name:var(--font-display)] text-base font-medium text-[#1B1B16]">Hull House</p>
                  <p className="text-xs text-[#8A8A7E]">42 staff tracked · 91% compliant</p>
                </div>
                <span className="rounded-full bg-[#FBECEA] px-2.5 py-1 text-[11px] font-semibold text-[#B3432B]">2 need attention</span>
              </div>
              <div className="mt-5 space-y-1">
                {heroRows.map((row) => (
                  <div key={row.name} className="flex items-center justify-between border-t border-[#E5E0D2] py-3 first:border-t-0">
                    <div>
                      <p className="text-sm font-medium text-[#1B1B16]">{row.name}</p>
                      <p className="text-xs text-[#8A8A7E]">{row.role}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${heroStatusStyles[row.status]}`}>
                      {heroStatusLabels[row.status]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute -bottom-4 -left-4 hidden items-center gap-2.5 rounded-xl border border-black/5 bg-[#F5F3EE] px-3.5 py-2.5 shadow-xl shadow-black/30 sm:flex">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EDF2EC] text-[#1F6B45]">
                <IconBell />
              </span>
              <div className="leading-tight">
                <p className="text-xs font-semibold text-[#1B1B16]">Reminder sent</p>
                <p className="text-[11px] text-[#8A8A7E]">Priya's DBS check</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-b border-[#E5E0D2] bg-white py-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-6 text-center md:flex-row md:justify-between md:text-left">
          <p className="text-sm font-medium text-[#6B6A61]">Built for teams that can't afford to guess</p>
          <p className="text-sm font-medium text-[#1B1B16]">{industries.join("   ·   ")}</p>
        </div>
      </section>

      {/* Features - the same rounded-2xl bordered white card already used for the signup plan
          picker, with a small icon-in-circle instead of a plan's radio dot. */}
      <section id="features" className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1F6B45]">What you get</p>
          <h2 className="mt-3 max-w-2xl font-[family-name:var(--font-display)] text-3xl font-medium text-[#1B1B16] md:text-4xl">
            Everything between a scanned document and a peaceful audit.
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-2xl border border-[#E5E0D2] bg-white p-6 transition hover:border-[#1F6B45]/40">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EDF2EC] text-[#1F6B45]">
                  <Icon />
                </span>
                <h3 className="mt-4 font-[family-name:var(--font-display)] text-lg font-medium text-[#1B1B16]">{title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-[#6B6A61]">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works - icons on a connecting line instead of numbered circles, framed in its
          own soft panel for a more considered, editorial feel than a plain full-bleed grid. */}
      <section id="how" className="border-y border-[#E5E0D2] bg-[#FCFAF5] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1F6B45]">How it works</p>
          <h2 className="mt-3 max-w-2xl font-[family-name:var(--font-display)] text-3xl font-medium text-[#1B1B16] md:text-4xl">
            From a scanned document to a peaceful audit.
          </h2>

          <div className="mt-12 rounded-3xl border border-[#E5E0D2] bg-white p-8 shadow-sm md:p-12">
            <div className="grid gap-12 md:grid-cols-4 md:gap-8">
              {steps.map((step, i) => (
                <div key={step.title} className="relative">
                  {i < steps.length - 1 && (
                    <div className="pointer-events-none absolute left-7 top-7 hidden h-px w-full bg-gradient-to-r from-[#1F6B45]/30 to-transparent md:block" />
                  )}
                  <span className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-[#1F6B45] text-white shadow-md shadow-[#1F6B45]/25">
                    <step.icon className="h-6 w-6" />
                  </span>
                  <p className="mt-5 font-[family-name:var(--font-display)] text-sm italic text-[#1F6B45]">{step.eyebrow}</p>
                  <h3 className="mt-1 font-[family-name:var(--font-display)] text-lg font-medium text-[#1B1B16]">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#6B6A61]">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing - the exact plan-picker styling from /signup, so choosing a plan there feels
          like the same product, not a different page's idea of what a pricing card looks like. */}
      <section id="pricing" className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1F6B45]">Pricing</p>
          <h2 className="mt-3 max-w-2xl font-[family-name:var(--font-display)] text-3xl font-medium text-[#1B1B16] md:text-4xl">
            One platform, priced by how much you're tracking.
          </h2>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[#6B6A61]">
            Every plan below runs the exact same product — the compliance matrix, both cloud connectors, custom
            rules, reminders, the lot. The only thing that changes is your monthly record allowance.
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
                className={`relative flex flex-col rounded-2xl border p-6 ${
                  plan.highlighted ? "border-[#1F6B45] bg-[#12140F] text-[#F5F3EE] shadow-xl shadow-black/10" : "border-[#E5E0D2] bg-white text-[#1B1B16]"
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
              <details key={item.question} className="group rounded-2xl border border-[#E5E0D2] bg-white px-6 py-5 open:border-[#1F6B45]/30">
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
