 "use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const features = [
  {
    title: "Automated ingestion",
    description: "Watch local folders or connect cloud drives to capture PDFs and scans in minutes."
  },
  {
    title: "OCR + rule engine",
    description: "Extract staff, course, and dates with OCR, then infer expiry with tenant overrides."
  },
  {
    title: "Reliable reminders",
    description: "Weekly digests, expiry lead times, and one-click actions keep admins ahead."
  },
  {
    title: "Hardened devices",
    description: "Enroll agents securely, monitor heartbeats, and queue offline until back online."
  }
];

const faqs = [
  {
    question: "How does onboarding work?",
    answer:
      "Pick a plan, complete Stripe checkout, and your tenant is provisioned automatically. You can invite admins, enroll a device, and start ingesting certificates right away."
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
      "Yes. We offer a 7-day trial and still collect a payment method up front. One trial per customer; after trial end, billing begins automatically unless cancelled before day 7."
  }
];

const plans = [
  {
    name: "Starter",
    price: "$99/mo",
    blurb: "For small teams getting off spreadsheets.",
    features: ["50 records/month", "Local folders", "30-day retention"],
    cta: "Start 7-day trial"
  },
  {
    name: "Growth",
    price: "$249/mo",
    blurb: "For growing orgs with cloud connectors.",
    features: ["500 records/month", "Google/OneDrive/Dropbox", "1-year retention"],
    cta: "Start 7-day trial",
    highlighted: true
  },
  {
    name: "Pro",
    price: "$499/mo",
    blurb: "For ops teams that need everything.",
    features: ["Unlimited records", "Webhooks/API", "Priority support"],
    cta: "Start 7-day trial"
  }
];

export default function LandingPage() {
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    setHasSession(document.cookie.includes("cw_session="));
  }, []);

  return (
    <main className="bg-slate-50 pb-16">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-slate-900">CertiWatch</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-700 md:flex">
            <Link href="#home" className="hover:text-slate-900">
              Home
            </Link>
            <Link href="#pricing" className="hover:text-slate-900">
              Pricing
            </Link>
            <Link href="#faq" className="hover:text-slate-900">
              FAQ
            </Link>
            <Link href="#contact" className="hover:text-slate-900">
              Contact
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            {hasSession ? (
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-500"
              >
                Go to dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-300 md:inline-flex"
                >
                  Login
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-500"
                >
                  Start 7-day trial
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section id="home" className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-slate-50">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.12),transparent_25%),radial-gradient(circle_at_80%_0%,rgba(14,165,233,0.12),transparent_20%)]" />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-10 px-6 py-16 md:flex-row md:items-center md:py-24">
          <div className="flex-1 space-y-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">CertiWatch</p>
            <h1 className="text-4xl font-bold leading-tight text-slate-900 md:text-5xl">
              Certificate compliance without the chaos
            </h1>
            <p className="text-lg text-slate-600 md:text-xl">
              CertiWatch ingests certificates from your agents and cloud drives, extracts dates and issuers,
              applies your rules, and keeps admins ahead with reminders and one-click approvals.
            </p>
            <div className="flex flex-wrap gap-3">
              {hasSession ? (
                <Link
                  href="/"
                  className="inline-flex items-center justify-center rounded-md bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-blue-500"
                >
                  Go to dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/signup"
                    className="inline-flex items-center justify-center rounded-md bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-blue-500"
                  >
                    Start 7-day trial
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-300"
                  >
                    Login
                  </Link>
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-slate-600">
              <span>OCR + rule engine</span>
              <span className="text-slate-300">|</span>
              <span>Weekly digests and reminders</span>
              <span className="text-slate-300">|</span>
              <span>Secure device enrollment</span>
            </div>
          </div>
          <div className="flex-1">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-500">Demo snapshot</p>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  Sample data
                </span>
              </div>
              <div className="grid gap-4 pt-4 md:grid-cols-2">
                {[
                  { label: "New records", value: "--" },
                  { label: "Expiring soon", value: "--" },
                  { label: "Expired", value: "--" },
                  { label: "Low confidence", value: "--" }
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">{stat.label}</p>
                    <p className="text-2xl font-semibold text-slate-900">{stat.value}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-slate-500">Connect folders to see live metrics.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl space-y-8 px-6 pt-12">
        <div className="space-y-2 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Pricing</p>
          <h2 className="text-3xl font-semibold text-slate-900">Transparent plans for every stage</h2>
          <p className="text-slate-600">All plans include the rule engine, reminders, and secure device enrollment.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl border p-6 shadow-sm ${
                plan.highlighted ? "border-blue-500 ring-2 ring-blue-200 bg-white" : "border-slate-200 bg-white"
              }`}
            >
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{plan.name}</p>
              <p className="text-3xl font-bold text-slate-900">{plan.price}</p>
              <p className="mt-2 text-sm text-slate-600">{plan.blurb}</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-700">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
                    {feat}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className={`mt-6 inline-flex w-full items-center justify-center rounded-md px-4 py-2 text-sm font-semibold shadow-sm ${
                  plan.highlighted
                    ? "bg-blue-600 text-white hover:bg-blue-500"
                    : "border border-slate-200 bg-white text-slate-800 hover:border-slate-300"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section id="why" className="mx-auto max-w-6xl space-y-8 px-6 pt-16">
        <div className="space-y-2 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Why CertiWatch</p>
          <h2 className="text-3xl font-semibold text-slate-900">Built for compliance-heavy teams</h2>
          <p className="text-slate-600">
            From folder agents to cloud connectors, keep every certificate audited with zero spreadsheet drama.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">{feature.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-6xl space-y-8 px-6 pt-16">
        <div className="space-y-2 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">FAQ</p>
          <h2 className="text-3xl font-semibold text-slate-900">Answers for buyers and admins</h2>
          <p className="text-slate-600">Everything you need to know before enrolling your first device.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {faqs.map((item) => (
            <div key={item.question} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-slate-900">{item.question}</h3>
              <p className="mt-2 text-sm text-slate-600">{item.answer}</p>
            </div>
          ))}
        </div>
      </section>

      <footer id="contact" className="mt-16 border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-lg font-bold text-slate-900">CertiWatch</p>
            <p className="text-sm text-slate-600">Compliance-grade certificate tracking for SMB teams.</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-700">
            <Link href="mailto:hello@certiwatch.com" className="hover:text-slate-900">
              hello@certiwatch.com
            </Link>
            <span className="hidden text-slate-300 md:inline">|</span>
            {hasSession ? (
              <Link href="/" className="font-semibold text-blue-600 hover:text-blue-500">
                Go to dashboard
              </Link>
            ) : (
              <>
                <Link href="/signup" className="font-semibold text-blue-600 hover:text-blue-500">
                  Start trial
                </Link>
                <Link href="/login" className="font-semibold text-slate-800 hover:text-slate-900">
                  Login
                </Link>
              </>
            )}
          </div>
        </div>
      </footer>
    </main>
  );
}
