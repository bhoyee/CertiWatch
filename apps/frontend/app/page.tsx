"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Fraunces, Source_Serif_4, Courier_Prime } from "next/font/google";

// This page intentionally does not use the shared SiteHeader/SiteFooter or lib/fonts - it commits
// to its own visual language and stays scoped to this one route so /login and /signup are
// unaffected. Visual system: tactile paper & ink - a real generated paper-grain texture as the
// page surface, a real photographic-style certificate (built the same way as the documentation
// illustrations earlier this session) as the hero image, deckle-edge section dividers, and a
// deliberately asymmetric layout - no pill badges, no dot indicators, no rounded-card grids. That
// trio (pill+dot eyebrow, soft-shadow icon cards, centered SaaS layout) is the most recognizable
// "generated landing page" fingerprint, so every one of those patterns is avoided here on purpose.
const display = Fraunces({ subsets: ["latin"], weight: ["600", "700", "900"], style: ["normal", "italic"], variable: "--font-display" });
const bodyFont = Source_Serif_4({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body" });
const mono = Courier_Prime({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-mono" });

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

// A deterministic torn/deckle edge (not random - server and client must render the same markup),
// used as a section-divider strip instead of a plain straight rule.
function deckleClipPath(teeth = 32): string {
  const points = ["0% 0%", "100% 0%"];
  for (let i = teeth; i >= 0; i--) {
    const x = (i / teeth) * 100;
    const y = i % 2 === 0 ? 100 : 78;
    points.push(`${x}% ${y}%`);
  }
  return `polygon(${points.join(", ")})`;
}

export default function LandingPage() {
  const [hasSession, setHasSession] = useState(false);
  const year = new Date().getFullYear();

  useEffect(() => {
    setHasSession(document.cookie.includes("cw_session="));
  }, []);

  return (
    <div
      className={`${display.variable} ${bodyFont.variable} ${mono.variable} font-[family-name:var(--font-body)] text-[#241C13]`}
      style={{ backgroundImage: "url(/landing/paper-texture.jpg)", backgroundSize: "1100px", backgroundColor: "#ECE4D0" }}
    >
      {/* Masthead */}
      <header className="border-b-2 border-[#241C13]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight">
            CertiWatch
          </Link>
          <nav className="hidden items-center gap-8 font-[family-name:var(--font-mono)] text-xs uppercase tracking-wide text-[#4A4030] md:flex">
            <Link href="#features" className="hover:text-[#241C13]">Features</Link>
            <Link href="#how" className="hover:text-[#241C13]">How it works</Link>
            <Link href="#pricing" className="hover:text-[#241C13]">Pricing</Link>
            <Link href="#faq" className="hover:text-[#241C13]">FAQ</Link>
          </nav>
          <div className="flex items-center gap-4">
            {hasSession ? (
              <Link
                href="/analytics"
                className="border-2 border-[#241C13] px-4 py-2 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-wide transition hover:bg-[#241C13] hover:text-[#ECE4D0]"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="hidden font-[family-name:var(--font-mono)] text-xs uppercase tracking-wide text-[#4A4030] hover:text-[#241C13] md:inline">
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="border-2 border-[#241C13] bg-[#241C13] px-4 py-2 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-wide text-[#ECE4D0] transition hover:bg-[#7A1F1F] hover:border-[#7A1F1F]"
                >
                  Start trial
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero - deliberately asymmetric: a narrower copy column against a wider, off-grid photo
          that bleeds past its column into the margin. */}
      <section className="overflow-hidden">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 pb-10 pt-14 md:grid-cols-[0.85fr_1.15fr] md:items-center md:pb-16 md:pt-20">
          <div>
            <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.2em] text-[#6B5D4F]">
              Built for care, construction &amp; hospitality teams
            </p>
            <h1 className="mt-5 max-w-md font-[family-name:var(--font-display)] text-[2.5rem] font-bold leading-[1.08] tracking-tight md:text-[3.1rem]">
              Stop finding out something's expired <span className="italic text-[#7A1F1F]">after</span> the inspector does.
            </h1>
            <p className="mt-6 max-w-sm text-lg leading-relaxed text-[#4A4030]">
              CertiWatch watches every folder and cloud drive your staff certificates, licenses, and inspection
              documents land in, reads the expiry off the page, matches it to the right person, and tells you —
              and only you — before it runs out.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              {hasSession ? (
                <Link
                  href="/analytics"
                  className="inline-flex items-center justify-center border-2 border-[#241C13] bg-[#241C13] px-6 py-3 font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-wide text-[#ECE4D0] transition hover:bg-[#7A1F1F] hover:border-[#7A1F1F]"
                >
                  Go to dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/signup"
                    className="inline-flex items-center justify-center border-2 border-[#241C13] bg-[#241C13] px-6 py-3 font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-wide text-[#ECE4D0] transition hover:bg-[#7A1F1F] hover:border-[#7A1F1F]"
                  >
                    Start 7-day trial
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center border-2 border-[#241C13] px-6 py-3 font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-wide text-[#241C13] transition hover:bg-[#241C13] hover:text-[#ECE4D0]"
                  >
                    Log in
                  </Link>
                </>
              )}
            </div>
            <p className="mt-6 font-[family-name:var(--font-mono)] text-xs uppercase tracking-wide text-[#8A7C68]">
              7-day free trial · Card required upfront · Cancel anytime before billing starts
            </p>
          </div>

          {/* Real generated photographic certificate - not a UI screenshot, not an icon - a
              genuine rendered document with grain, a cast shadow, and a hand-stamped seal. It
              bleeds past the grid column on desktop for the asymmetric, off-template feel. */}
          <div className="relative md:-mr-16 lg:-mr-28">
            <img
              src="/landing/certificate-hero.png"
              alt="A CertiWatch compliance certificate, stamped Compliant"
              className="mx-auto w-full max-w-xl md:max-w-none"
            />
          </div>
        </div>
      </section>

      <div aria-hidden="true" className="h-7 bg-[#241C13]" style={{ clipPath: deckleClipPath() }} />

      {/* Trust strip */}
      <section className="bg-[#241C13] pb-6 pt-2">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-6 text-center md:flex-row md:justify-between md:text-left">
          <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-wide text-[#B8AC97]">
            Built for teams that can't afford to guess
          </p>
          <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-wide text-[#ECE4D0]">
            {industries.join("  ·  ")}
          </p>
        </div>
      </section>

      {/* Features - a numbered editorial list, not an icon-card grid */}
      <section id="features" className="border-b-2 border-[#241C13] py-20">
        <div className="mx-auto max-w-5xl px-6">
          <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.2em] text-[#6B5D4F]">What you get</p>
          <h2 className="mt-3 max-w-2xl font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight md:text-4xl">
            Everything between a scanned document and a peaceful audit.
          </h2>
          <div className="mt-14 grid gap-x-14 gap-y-12 md:grid-cols-2">
            {features.map((feature, i) => (
              <div key={feature.title} className="border-t-2 border-[#241C13] pt-5">
                <span className="font-[family-name:var(--font-display)] text-3xl italic text-[#7A1F1F]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-2 font-[family-name:var(--font-display)] text-xl font-bold tracking-tight">{feature.title}</h3>
                <p className="mt-2 max-w-md text-[15px] leading-relaxed text-[#4A4030]">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works - a stamp trail, since "steps in a process" is what a row of passport
          stamps already looks like */}
      <section id="how" className="border-b-2 border-[#241C13] py-20">
        <div className="mx-auto max-w-5xl px-6">
          <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.2em] text-[#6B5D4F]">How it works</p>
          <h2 className="mt-3 max-w-2xl font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight md:text-4xl">
            Four steps, and none of them are "chase someone over email."
          </h2>
          <div className="relative mt-16">
            <div className="absolute left-5 top-5 bottom-5 w-px bg-[#241C13]/25 md:left-0 md:right-0 md:top-5 md:bottom-auto md:h-px md:w-auto" />
            <div className="grid gap-10 md:grid-cols-4">
              {steps.map((step) => (
                <div key={step.n} className="relative flex gap-4 md:flex-col md:gap-4">
                  <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[#241C13] bg-[#ECE4D0] font-[family-name:var(--font-mono)] text-xs font-bold">
                    {step.n}
                  </span>
                  <div className="pt-1 md:pt-0">
                    <h3 className="font-[family-name:var(--font-display)] text-base font-bold tracking-tight">{step.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-[#4A4030]">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing - ticket stubs, with a perforated tear line between the plan and its details */}
      <section id="pricing" className="border-b-2 border-[#241C13] py-20">
        <div className="mx-auto max-w-5xl px-6">
          <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.2em] text-[#6B5D4F]">Pricing</p>
          <h2 className="mt-3 max-w-2xl font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight md:text-4xl">
            One platform, priced by how much you're tracking.
          </h2>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[#4A4030]">
            Every plan below runs the exact same product — the compliance matrix, both cloud connectors, custom rules,
            reminders, the lot. The only thing that changes is your monthly record allowance.
          </p>

          {/* What's included everywhere - stated once so the three stubs below aren't three
              invented feature lists pretending the tiers differ on capability. */}
          <ul className="mt-8 grid gap-x-8 gap-y-2.5 border-2 border-[#241C13] bg-[#F7F1E3] p-6 sm:grid-cols-2 md:grid-cols-3">
            {sharedFeatures.map((feat) => (
              <li key={feat} className="flex items-start gap-2.5 font-[family-name:var(--font-mono)] text-xs">
                <span className="text-[#7A1F1F]">·</span>
                <span className="text-[#4A4030]">{feat}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 grid gap-8 md:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative flex flex-col border-2 bg-[#F7F1E3] ${
                  plan.highlighted ? "border-[#7A1F1F] md:-translate-y-2" : "border-[#241C13]"
                }`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 left-6 bg-[#7A1F1F] px-2.5 py-1 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-wide text-[#F7F1E3]">
                    Most popular
                  </span>
                )}
                <div className="p-7">
                  <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-wide text-[#6B5D4F]">{plan.name}</p>
                  <p className="mt-2 flex items-baseline gap-1">
                    <span className="font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight">{plan.price}</span>
                    <span className="text-[#6B5D4F]">/mo</span>
                  </p>
                  <p className="mt-3 text-sm text-[#4A4030]">{plan.blurb}</p>
                </div>

                {/* Perforated tear line - a ticket stub, not a card divider */}
                <div className="relative">
                  <div className="absolute -left-[9px] top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-[#ECE4D0]" />
                  <div className="absolute -right-[9px] top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-[#ECE4D0]" />
                  <div className="border-t-2 border-dashed border-[#241C13]/40" />
                </div>

                <div className="flex flex-1 flex-col p-7">
                  <div className="space-y-1.5">
                    <p className="text-sm font-bold text-[#241C13]">{plan.limit}</p>
                    <p className="text-sm text-[#6B5D4F]">{plan.support}</p>
                  </div>
                  <Link
                    href="/signup"
                    className={`mt-6 inline-flex items-center justify-center border-2 px-4 py-3 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-wide transition ${
                      plan.highlighted
                        ? "border-[#7A1F1F] bg-[#7A1F1F] text-[#F7F1E3] hover:bg-[#5E1818]"
                        : "border-[#241C13] text-[#241C13] hover:bg-[#241C13] hover:text-[#F7F1E3]"
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20">
        <div className="mx-auto max-w-3xl px-6">
          <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.2em] text-[#6B5D4F]">FAQ</p>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight md:text-4xl">
            Answers for buyers and admins
          </h2>
          <div className="mt-10 border-2 border-[#241C13] bg-[#F7F1E3]">
            {faqs.map((item, i) => (
              <details key={item.question} className={`group px-6 py-5 ${i !== 0 ? "border-t border-[#241C13]/25" : ""}`}>
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
                  <span className="flex items-baseline gap-4">
                    <span className="font-[family-name:var(--font-mono)] text-xs text-[#8A7C68]">Q{String(i + 1).padStart(2, "0")}</span>
                    <span className="font-[family-name:var(--font-display)] text-base font-bold tracking-tight">{item.question}</span>
                  </span>
                  <span className="shrink-0 font-[family-name:var(--font-mono)] text-[#8A7C68] transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 pl-[3.1rem] text-[15px] leading-relaxed text-[#4A4030]">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <div aria-hidden="true" className="h-7 bg-[#241C13]" style={{ clipPath: deckleClipPath() }} />

      {/* Final CTA */}
      <section className="bg-[#241C13] py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-[#F7F1E3] md:text-4xl">
            Your next inspection is already on the calendar.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[#C7BBA4]">
            Give CertiWatch a week to watch your first folder or drive. You'll know exactly who's expiring — and when — before anyone asks.
          </p>
          {hasSession ? (
            <Link
              href="/analytics"
              className="mt-8 inline-flex items-center justify-center border-2 border-[#F7F1E3] bg-[#F7F1E3] px-7 py-3 font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-wide text-[#241C13] transition hover:bg-transparent hover:text-[#F7F1E3]"
            >
              Go to dashboard
            </Link>
          ) : (
            <Link
              href="/signup"
              className="mt-8 inline-flex items-center justify-center border-2 border-[#F7F1E3] bg-[#F7F1E3] px-7 py-3 font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-wide text-[#241C13] transition hover:bg-transparent hover:text-[#F7F1E3]"
            >
              Start 7-day trial
            </Link>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-[family-name:var(--font-display)] text-sm font-bold tracking-tight">CertiWatch</p>
            <p className="mt-1 max-w-sm text-sm text-[#4A4030]">
              Compliance-grade renewal tracking for SMB teams — certificates, licenses, insurance &amp; more.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-5 font-[family-name:var(--font-mono)] text-xs uppercase tracking-wide">
            <Link href="mailto:hello@certiwatch.com" className="text-[#4A4030] hover:text-[#241C13]">
              hello@certiwatch.com
            </Link>
            {hasSession ? (
              <Link href="/analytics" className="font-bold text-[#7A1F1F] hover:text-[#241C13]">
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/signup" className="font-bold text-[#7A1F1F] hover:text-[#241C13]">
                  Start trial
                </Link>
                <Link href="/login" className="text-[#4A4030] hover:text-[#241C13]">
                  Log in
                </Link>
              </>
            )}
          </div>
        </div>
        <div className="mx-auto mt-8 max-w-6xl border-t border-[#241C13]/20 px-6 pt-6">
          <p className="font-[family-name:var(--font-mono)] text-[11px] text-[#8A7C68]">© {year} CertiWatch. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
