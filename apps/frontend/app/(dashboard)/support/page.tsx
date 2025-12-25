"use client";

import Link from "next/link";

export default function SupportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Support</h1>
        <p className="text-slate-600">Get help from your team or the platform support desk.</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-medium text-slate-900">Coming soon</h2>
        <p className="mt-2 text-slate-600">
          In-app tickets will land here. For now, reach out via email and we&apos;ll route it to the right person.
        </p>
        <div className="mt-4 flex gap-3">
          <Link
            href="mailto:support@certiwatch.test"
            className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Email support
          </Link>
          <Link
            href="/records"
            className="inline-flex items-center rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
