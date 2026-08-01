"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { display, body } from "@/lib/fonts";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

const steps = [
  {
    n: "01",
    title: "Enroll",
    description: "A device agent or cloud connector is registered to a tenant with a short-lived enrollment code."
  },
  {
    n: "02",
    title: "Ingest",
    description: "New documents land from a watched folder, a cloud drive, or a no-login upload link."
  },
  {
    n: "03",
    title: "Extract",
    description: "OCR reads who or what it covers, the issuer, and the dates. Anything uncertain is queued for a human look."
  },
  {
    n: "04",
    title: "Remind",
    description: "Tenant rules resolve the real expiry date, and reminders go out before it becomes a problem."
  }
];

const features = [
  {
    title: "One inbox for everything that expires",
    description:
      "Local folders, Google Drive, OneDrive, and Dropbox all feed the same review queue — no more chasing five people for the same PDF.",
    span: true
  },
  {
    title: "A rule engine that knows your exceptions",
    description: "Global defaults per document type, overridden per tenant, per vendor, or by regex — not a flat 12-month guess."
  },
  {
    title: "Nothing goes in unreviewed",
    description: "Low-confidence extractions land in a review queue instead of being silently accepted or dropped."
  },
  {
    title: "Reminders that actually fire",
    description: "A weekly digest plus configurable lead-time alerts, sent before the renewal window closes."
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
      "Pick a plan, complete Stripe checkout, and your tenant is provisioned automatically. You can invite admins, enroll a device, and start ingesting documents right away."
  },
  {
    question: "Where are documents stored?",
    answer:
      "Documents stay on your storage. We track metadata plus optional hashes/paths. If you enable cloud connectors, we fetch with read-only scopes."
  },
  {
    question: "Can I change rules later?",
    answer: "Yes. Global defaults plus tenant overrides. We reprocess records in real time when rules change."
  },
  {
    question: "Do you support trials?",
    answer:
      "Yes — a 7-day trial, card required up front. One trial per customer; billing begins automatically on day 7 unless you cancel first."
  }
];

const plans = [
  {
    name: "Starter",
    price: "$99",
    blurb: "For small teams tracking their first few renewal dates.",
    features: ["50 records / month", "Local folder ingestion", "30-day document retention"],
    cta: "Start 7-day trial"
  },
  {
    name: "Growth",
    price: "$249",
    blurb: "For growing orgs juggling certs, licenses, and insurance.",
    features: ["500 records / month", "Google Drive, OneDrive, Dropbox", "1-year document retention"],
    cta: "Start 7-day trial",
    highlighted: true
  },
  {
    name: "Pro",
    price: "$499",
    blurb: "For ops teams tracking everything that could lapse.",
    features: ["Unlimited records", "Webhooks & API access", "Priority support"],
    cta: "Start 7-day trial"
  }
];

const certCards = [
  { initials: "AM", title: "Amara Musa", subtitle: "First Aid at Work", status: "valid", detail: "Valid · 214 days left" },
  { initials: "FV", title: "Fleet Van 04", subtitle: "MOT & service", status: "warning", detail: "Renew in 12 days" },
  { initials: "PL", title: "Public Liability", subtitle: "Insurance policy", status: "review", detail: "Needs review" }
];

function StatusDot({ status }: { status: string }) {
  const color = status === "valid" ? "bg-[#1F6B45]" : status === "warning" ? "bg-[#B45309]" : "bg-[#6B6A61]";
  return <span className={`h-1.5 w-1.5 rounded-full ${color}`} />;
}

function IconInbox() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
      <path d="M3 12h4.2l1.6 3h6.4l1.6-3H21" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 12 6.6 5.4A2 2 0 0 1 8.5 4h7A2 2 0 0 1 17.4 5.4L19 12v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6Z" strokeLinejoin="round" />
    </svg>
  );
}

function IconBranch() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
      <circle cx="6" cy="6" r="2.2" />
      <circle cx="6" cy="18" r="2.2" />
      <circle cx="18" cy="12" r="2.2" />
      <path d="M6 8.2V15.8M8 6.6h4a4 4 0 0 1 4 4v0M8 17.4h4a4 4 0 0 0 4-4v0" strokeLinecap="round" />
    </svg>
  );
}

function IconReview() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
      <rect x="4" y="3.5" width="12" height="17" rx="1.5" />
      <path d="M7.5 8h5M7.5 11.5h5M7.5 15h3" strokeLinecap="round" />
      <circle cx="17.5" cy="17.5" r="3" />
      <path d="m19.8 19.8 1.7 1.7" strokeLinecap="round" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
      <path d="M6 10a6 6 0 1 1 12 0c0 3.4 1 5 1.6 5.8H4.4C5 15 6 13.4 6 10Z" strokeLinejoin="round" />
      <path d="M10 18.5a2 2 0 0 0 4 0" strokeLinecap="round" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
      <rect x="5" y="10.5" width="14" height="9.5" rx="1.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
      <circle cx="12" cy="15" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

const featureIcons = [IconInbox, IconBranch, IconReview, IconBell, IconLock];

export default function LandingPage() {
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    setHasSession(document.cookie.includes("cw_session="));
  }, []);

  return (
    <div className={`${display.variable} ${body.variable} font-[family-name:var(--font-body)] bg-[#FAF7F0] text-[#1B1B16]`}>
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden bg-[#12140F]">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(#F5F3EE 1px, transparent 1px), linear-gradient(90deg, #F5F3EE 1px, transparent 1px)",
            backgroundSize: "48px 48px"
          }}
        />
        <div className="relative mx-auto grid max-w-6xl gap-14 px-6 py-20 md:grid-cols-[1.1fr_0.9fr] md:items-center md:py-28">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#4E9C74]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#4E9C74]" />
              Every renewal, handled
            </p>
            <h1 className="mt-5 max-w-xl font-[family-name:var(--font-display)] text-4xl font-medium leading-[1.08] text-[#F5F3EE] md:text-[3.25rem]">
              Stop finding out something's expired <em className="not-italic text-[#4E9C74]">after</em> the inspector
              does.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-[#C9C7BC]">
              CertiWatch watches every folder and cloud drive your certificates, licenses, insurance, and inspection
              documents land in, reads the expiry off the page, and tells you — and only you — before it runs out.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              {hasSession ? (
                <Link
                  href="/analytics"
                  className="inline-flex items-center justify-center rounded-md bg-[#1F6B45] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-black/20 transition hover:bg-[#195939]"
                >
                  Go to dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/signup"
                    className="inline-flex items-center justify-center rounded-md bg-[#1F6B45] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-black/20 transition hover:bg-[#195939]"
                  >
                    Start 7-day trial
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center rounded-md border border-white/15 px-6 py-3.5 text-sm font-semibold text-[#F5F3EE] transition hover:border-white/30 hover:bg-white/5"
                  >
                    Log in
                  </Link>
                </>
              )}
            </div>
            <p className="mt-8 text-sm text-[#8A8A7E]">
              No card surprises — 7 days free, cancel before it ends. · Built for care, construction &amp; hospitality
              teams.
            </p>
          </div>

          {/* Stacked compliance-item cards */}
          <div className="relative h-[360px] md:h-[420px]">
            {certCards.map((card, i) => (
              <div
                key={card.title}
                className="absolute w-72 rounded-xl border border-black/5 bg-[#FFFDF8] p-5 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.45)]"
                style={{
                  top: `${i * 104}px`,
                  left: `${i * 30}px`,
                  transform: `rotate(${i === 0 ? -4 : i === 1 ? 1.5 : -1}deg)`,
                  zIndex: certCards.length - i
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#12140F] text-xs font-semibold text-[#F5F3EE]">
                    {card.initials}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#1B1B16]">{card.title}</p>
                    <p className="text-xs text-[#6B6A61]">{card.subtitle}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 border-t border-black/5 pt-3 text-xs font-medium text-[#4B4A42]">
                  <StatusDot status={card.status} />
                  {card.detail}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-b border-[#E5E0D2] bg-[#FAF7F0] py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 text-center md:flex-row md:justify-between md:text-left">
          <p className="text-sm text-[#6B6A61]">Built for teams that can't afford to guess about compliance</p>
          <div className="flex flex-wrap justify-center gap-2.5">
            {["Care homes", "Construction", "Hospitality", "Facilities"].map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[#E5E0D2] bg-white px-3.5 py-1.5 text-xs font-medium text-[#4B4A42]"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-24">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1F6B45]">What you get</p>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-medium text-[#1B1B16] md:text-4xl">
            Everything between a scanned document and a peaceful audit.
          </h2>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {features.map((feature, i) => {
            const Icon = featureIcons[i];
            return (
              <div
                key={feature.title}
                className={`rounded-xl border border-[#E5E0D2] bg-white p-7 ${feature.span ? "md:col-span-2" : ""}`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#EDF2EC] text-[#1F6B45]">
                  <Icon />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-[#1B1B16]">{feature.title}</h3>
                <p className="mt-2 max-w-md text-[15px] leading-relaxed text-[#6B6A61]">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="bg-[#12140F] py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4E9C74]">How it works</p>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-medium text-[#F5F3EE] md:text-4xl">
              Four steps, and none of them are "chase someone over email."
            </h2>
          </div>
          <div className="mt-14 grid gap-x-8 gap-y-12 md:grid-cols-4">
            {steps.map((step) => (
              <div key={step.n} className="border-t border-white/10 pt-6">
                <span className="font-[family-name:var(--font-display)] text-3xl italic text-[#4E9C74]">{step.n}</span>
                <h3 className="mt-3 text-base font-semibold text-[#F5F3EE]">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#9B9A8E]">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-24">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1F6B45]">Pricing</p>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-medium text-[#1B1B16] md:text-4xl">
            Plans that scale with how many things you're tracking.
          </h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-2xl border p-7 ${
                plan.highlighted
                  ? "border-[#1F6B45] bg-[#12140F] text-[#F5F3EE] shadow-xl shadow-black/10 md:-translate-y-3"
                  : "border-[#E5E0D2] bg-white text-[#1B1B16]"
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-7 rounded-full bg-[#1F6B45] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                  Most popular
                </span>
              )}
              <p
                className={`text-sm font-semibold uppercase tracking-wide ${
                  plan.highlighted ? "text-[#8FBBA2]" : "text-[#6B6A61]"
                }`}
              >
                {plan.name}
              </p>
              <p className="mt-2 flex items-baseline gap-1">
                <span className="font-[family-name:var(--font-display)] text-4xl font-medium">{plan.price}</span>
                <span className={plan.highlighted ? "text-[#9B9A8E]" : "text-[#6B6A61]"}>/mo</span>
              </p>
              <p className={`mt-3 text-sm ${plan.highlighted ? "text-[#C9C7BC]" : "text-[#6B6A61]"}`}>{plan.blurb}</p>
              <ul className="mt-6 space-y-2.5 text-sm">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2.5">
                    <span
                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                        plan.highlighted ? "bg-[#4E9C74]" : "bg-[#1F6B45]"
                      }`}
                    />
                    <span className={plan.highlighted ? "text-[#E7E5DA]" : "text-[#4B4A42]"}>{feat}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className={`mt-8 inline-flex items-center justify-center rounded-md px-4 py-3 text-sm font-semibold transition ${
                  plan.highlighted
                    ? "bg-[#1F6B45] text-white hover:bg-[#195939]"
                    : "border border-[#E5E0D2] text-[#1B1B16] hover:border-[#1F6B45]"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-6 py-24">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1F6B45]">FAQ</p>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-medium text-[#1B1B16] md:text-4xl">
            Answers for buyers and admins
          </h2>
        </div>
        <div className="mt-12 divide-y divide-[#E5E0D2] border-y border-[#E5E0D2]">
          {faqs.map((item) => (
            <details key={item.question} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold text-[#1B1B16]">
                {item.question}
                <span className="shrink-0 text-lg text-[#1F6B45] transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[#6B6A61]">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-[#12140F] py-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-medium text-[#F5F3EE] md:text-4xl">
            Your next inspection is already on the calendar.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[#C9C7BC]">
            Give CertiWatch a week to watch your first folder. You'll know exactly what's expiring before anyone
            asks.
          </p>
          {hasSession ? (
            <Link
              href="/analytics"
              className="mt-8 inline-flex items-center justify-center rounded-md bg-[#1F6B45] px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-black/20 transition hover:bg-[#195939]"
            >
              Go to dashboard
            </Link>
          ) : (
            <Link
              href="/signup"
              className="mt-8 inline-flex items-center justify-center rounded-md bg-[#1F6B45] px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-black/20 transition hover:bg-[#195939]"
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
