"use client";

import { useState } from "react";
import { postJson } from "../../lib/api";

type Plan = {
  id: string;
  name: string;
  price: string;
  description: string;
  features: string[];
};

const plans: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    price: "$99/mo",
    description: "Up to 50 records, local folders only",
    features: ["1 admin", "Local folders", "30-day retention"]
  },
  {
    id: "growth",
    name: "Growth",
    price: "$249/mo",
    description: "500 records, cloud connectors",
    features: ["5 admins", "Drive connectors", "Custom reminders"]
  },
  {
    id: "pro",
    name: "Pro",
    price: "$499/mo",
    description: "Unlimited records and features",
    features: ["Unlimited admins", "Webhooks", "Priority support"]
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
    <div className="mx-auto max-w-4xl space-y-8 px-6 py-12">
      <div className="text-center">
        <p className="text-sm uppercase tracking-wide text-slate-500">Start your trial</p>
        <h1 className="text-3xl font-semibold text-slate-900">Choose a plan that grows with you</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <button
            key={plan.id}
            type="button"
            onClick={() => setPlanId(plan.id)}
            className={`rounded-xl border p-4 text-left shadow-sm transition ${
              plan.id === planId ? "border-blue-500 ring-2 ring-blue-200" : "border-slate-200"
            }`}
          >
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{plan.name}</p>
            <p className="text-2xl font-bold text-slate-900">{plan.price}</p>
            <p className="mt-2 text-sm text-slate-600">{plan.description}</p>
            <ul className="mt-3 space-y-1 text-sm text-slate-600">
              {plan.features.map((feature) => (
                <li key={feature}>• {feature}</li>
              ))}
            </ul>
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Company & admin details</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm text-slate-600">
            Company name
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              required
            />
          </label>
          <label className="text-sm text-slate-600">
            Admin full name
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              value={adminName}
              onChange={(event) => setAdminName(event.target.value)}
              required
            />
          </label>
        </div>
        <label className="text-sm text-slate-600">
          Admin email
          <input
            type="email"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            value={adminEmail}
            onChange={(event) => setAdminEmail(event.target.value)}
            required
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-blue-500 disabled:opacity-50"
        >
          {loading ? "Redirecting to Stripe…" : `Start ${selectedPlan.name}`}
        </button>
      </form>
    </div>
  );
}
