"use client";

import { useState } from "react";
import { postJson } from "@/lib/api";
import { display, body } from "@/lib/fonts";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

type Plan = {
  id: string;
  name: string;
  price: string;
  description: string;
  features: string[];
  highlighted?: boolean;
};

const plans: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    price: "$99",
    description: "For small teams getting off spreadsheets.",
    features: ["50 records / month", "Local folder ingestion", "30-day document retention"]
  },
  {
    id: "growth",
    name: "Growth",
    price: "$249",
    description: "For growing orgs bringing cloud drives online.",
    features: ["500 records / month", "Google Drive, OneDrive, Dropbox", "1-year document retention"],
    highlighted: true
  },
  {
    id: "pro",
    name: "Pro",
    price: "$499",
    description: "For ops teams that need it all wired in.",
    features: ["Unlimited records", "Webhooks & API access", "Priority support"]
  }
];

export default function SignupPage() {
  const [companyName, setCompanyName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [planId, setPlanId] = useState(plans[0].id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPlan = plans.find((plan) => plan.id === planId)!;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await postJson<{ checkoutUrl: string }, Record<string, string>>("/api/billing/checkout", {
        companyName,
        adminName,
        adminEmail,
        planId
      });

      window.location.href = response.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start checkout");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`${display.variable} ${body.variable} font-[family-name:var(--font-body)] min-h-screen bg-[#FAF7F0] text-[#1B1B16]`}>
      <SiteHeader />

      <section className="relative overflow-hidden bg-[#12140F] py-16">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(#F5F3EE 1px, transparent 1px), linear-gradient(90deg, #F5F3EE 1px, transparent 1px)",
            backgroundSize: "48px 48px"
          }}
        />
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4E9C74]">Start your trial</p>
          <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-medium text-[#F5F3EE] md:text-4xl">
            Pick a plan. Seven days free either way.
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-[#C9C7BC]">
            A card is required up front, but nothing is charged until day 7 — cancel any time before that.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-5 md:grid-cols-3">
          {plans.map((plan) => {
            const active = plan.id === planId;
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => setPlanId(plan.id)}
                className={`relative flex flex-col rounded-2xl border p-6 text-left transition ${
                  active
                    ? "border-[#1F6B45] bg-[#12140F] text-[#F5F3EE] shadow-xl shadow-black/10"
                    : "border-[#E5E0D2] bg-white text-[#1B1B16] hover:border-[#1F6B45]/50"
                }`}
              >
                {plan.highlighted && (
                  <span
                    className={`absolute -top-3 left-6 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                      active ? "bg-[#1F6B45] text-white" : "bg-[#EDF2EC] text-[#1F6B45]"
                    }`}
                  >
                    Most popular
                  </span>
                )}
                <div className="flex w-full items-center justify-between">
                  <p className={`text-sm font-semibold uppercase tracking-wide ${active ? "text-[#8FBBA2]" : "text-[#6B6A61]"}`}>
                    {plan.name}
                  </p>
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                      active ? "border-[#4E9C74] bg-[#4E9C74]" : "border-[#CBC7B6]"
                    }`}
                  >
                    {active && <span className="h-1.5 w-1.5 rounded-full bg-[#12140F]" />}
                  </span>
                </div>
                <p className="mt-2 flex items-baseline gap-1">
                  <span className="font-[family-name:var(--font-display)] text-3xl font-medium">{plan.price}</span>
                  <span className={active ? "text-[#9B9A8E]" : "text-[#6B6A61]"}>/mo</span>
                </p>
                <p className={`mt-2 text-sm ${active ? "text-[#C9C7BC]" : "text-[#6B6A61]"}`}>{plan.description}</p>
                <ul className="mt-5 space-y-2 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <span
                        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${active ? "bg-[#4E9C74]" : "bg-[#1F6B45]"}`}
                      />
                      <span className={active ? "text-[#E7E5DA]" : "text-[#4B4A42]"}>{feature}</span>
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="mx-auto mt-12 max-w-xl rounded-2xl border border-[#E5E0D2] bg-white p-8">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-medium text-[#1B1B16]">
            Company &amp; admin details
          </h2>
          <p className="mt-1.5 text-sm text-[#6B6A61]">
            You'll be redirected to Stripe to finish setting up the {selectedPlan.name} plan.
          </p>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="companyName" className="block text-sm font-medium text-[#1B1B16]">
                Company name
              </label>
              <input
                id="companyName"
                className="mt-1.5 w-full rounded-md border border-[#E5E0D2] bg-white px-3.5 py-2.5 text-sm text-[#1B1B16] placeholder:text-[#A8A69A] focus:border-[#1F6B45] focus:outline-none focus:ring-1 focus:ring-[#1F6B45]"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                placeholder="Acme Care Ltd"
                required
              />
            </div>
            <div>
              <label htmlFor="adminName" className="block text-sm font-medium text-[#1B1B16]">
                Admin full name
              </label>
              <input
                id="adminName"
                className="mt-1.5 w-full rounded-md border border-[#E5E0D2] bg-white px-3.5 py-2.5 text-sm text-[#1B1B16] placeholder:text-[#A8A69A] focus:border-[#1F6B45] focus:outline-none focus:ring-1 focus:ring-[#1F6B45]"
                value={adminName}
                onChange={(event) => setAdminName(event.target.value)}
                placeholder="Jordan Diaz"
                required
              />
            </div>
          </div>

          <div className="mt-5">
            <label htmlFor="adminEmail" className="block text-sm font-medium text-[#1B1B16]">
              Admin email
            </label>
            <input
              id="adminEmail"
              type="email"
              className="mt-1.5 w-full rounded-md border border-[#E5E0D2] bg-white px-3.5 py-2.5 text-sm text-[#1B1B16] placeholder:text-[#A8A69A] focus:border-[#1F6B45] focus:outline-none focus:ring-1 focus:ring-[#1F6B45]"
              value={adminEmail}
              onChange={(event) => setAdminEmail(event.target.value)}
              placeholder="jordan@acmecare.com"
              required
            />
          </div>

          {error && (
            <div className="mt-5 rounded-md border border-[#F0C9C3] bg-[#FBECEA] px-3.5 py-3 text-sm text-[#B3432B]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-7 inline-flex w-full items-center justify-center rounded-md bg-[#1F6B45] py-3 text-sm font-semibold text-white transition hover:bg-[#195939] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Redirecting to Stripe…" : `Start ${selectedPlan.name} — ${selectedPlan.price}/mo`}
          </button>
          <p className="mt-4 text-center text-xs text-[#8A8A7E]">
            7 days free. Cancel before day 7 and you won't be charged.
          </p>
        </form>
      </section>

      <SiteFooter />
    </div>
  );
}
