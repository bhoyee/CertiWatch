"use client";

import { useState } from "react";

type Section = {
  id: string;
  title: string;
  content: React.ReactNode;
};

const sections: Section[] = [
  {
    id: "getting-started",
    title: "Getting started",
    content: (
      <>
        <p>
          CertiWatch keeps track of staff training certificates and compliance documents so nothing quietly expires
          without anyone noticing. The everyday flow is:
        </p>
        <ol className="mt-3 list-decimal space-y-1 pl-5">
          <li>A certificate gets into CertiWatch - you upload it, a connected device watches a folder for it, or it syncs in from Google Drive/OneDrive.</li>
          <li>CertiWatch reads it automatically (staff name, requirement type, issuer, issue and expiry dates) and creates a record.</li>
          <li>If it's confident in what it read, the record shows up straight away in <strong>Records</strong>. If anything looks uncertain or incomplete, it lands in <strong>Review</strong> first.</li>
          <li><strong>Compliance</strong> then shows, at a glance, who's covered for what - and who isn't.</li>
        </ol>
        <p className="mt-3">
          Nothing needs typing by hand for a normal certificate - the goal is that uploading is the only manual step.
        </p>
      </>
    )
  },
  {
    id: "uploading",
    title: "Uploading documents",
    content: (
      <>
        <p>
          Go to <strong>Uploads</strong> and drop in one or more files (PDF, PNG, JPG, or TIFF). A single PDF that
          contains several different certificates - for example, a council exporting one staff member's whole
          training history into one file - is handled automatically too: each page is treated as its own
          certificate, so you don't need to split files apart yourself before uploading.
        </p>
        <p className="mt-3">
          While a document is being read, you'll see a &ldquo;Processing…&rdquo; indicator on the record. This can
          take anywhere from a few seconds to a couple of minutes depending on the file and how many pages it has -
          there's no need to re-upload or refresh; it updates on its own once extraction finishes.
        </p>
      </>
    )
  },
  {
    id: "review",
    title: "Review queue",
    content: (
      <>
        <p>
          A document lands in <strong>Review</strong> instead of going straight to Records when CertiWatch couldn't
          confidently fill in every required field (staff name, requirement type, issuer, or issue date), or when the
          scan quality was too poor to read reliably. This isn't a failure - it just means a human should have a
          quick look before it counts as official.
        </p>
        <p className="mt-3">On the Review page you can:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Edit any field directly, and view the original document alongside it.</li>
          <li>
            If the requirement type doesn't match anything in your catalog, you'll see a suggestion for the closest
            existing one (so &ldquo;Moving and Handling for Children and Adults&rdquo; can match your existing
            &ldquo;Moving &amp; Handling&rdquo; requirement instead of creating a near-duplicate), or a link to add it
            as a genuinely new requirement type.
          </li>
          <li><strong>Approve</strong> once it looks right - this moves it into Records.</li>
          <li><strong>Save &amp; keep in queue</strong> to save your edits without approving yet - useful if you're still waiting on one more detail. It stays right there in this same queue.</li>
          <li><strong>Reject &amp; delete</strong> if the document doesn't belong at all (wrong file, duplicate, etc.) - this can't be undone.</li>
        </ul>
        <p className="mt-3">
          You can search and sort the queue by staff name, requirement type, issue date, expiry date, or confidence -
          useful once there are more than a handful of items waiting.
        </p>
      </>
    )
  },
  {
    id: "records",
    title: "Records",
    content: (
      <>
        <p>
          <strong>Records</strong> is the full list of everything CertiWatch has processed and approved. Every
          column header is sortable, and columns can be resized by dragging the edge of the header - your layout is
          remembered the next time you visit.
        </p>
        <p className="mt-3">
          A red expiry badge means the certificate is already past its expiry date, regardless of its current status
          - it's a purely date-based warning, not tied to how it was processed. You can filter by status, search
          across staff/requirement, and export the current view to CSV or PDF.
        </p>
        <p className="mt-3">
          If your plan has a record limit and you're over it, Records only shows your oldest records up to that
          limit - the rest are still safely stored (nothing is deleted or lost), and all of them reappear
          automatically the moment you upgrade.
        </p>
      </>
    )
  },
  {
    id: "compliance",
    title: "Compliance",
    content: (
      <>
        <p>
          <strong>Compliance</strong> is a grid: staff down one side, requirement types across the top. Each cell
          shows at a glance whether that person is covered, due soon, overdue, or missing that requirement entirely.
          Hover any cell for the exact dates behind it, including the expiry date for anything already expired.
        </p>
        <p className="mt-3">
          This is the page to check before an inspection or audit - it answers &ldquo;who still needs what&rdquo; in
          one screen instead of hunting through individual records.
        </p>
      </>
    )
  },
  {
    id: "staff",
    title: "Staff",
    content: (
      <>
        <p>
          Manage the list of staff members CertiWatch tracks compliance against. You can add people one at a time,
          or import a whole list from a CSV. Deactivating someone (rather than deleting them) keeps their historical
          certificates on record while removing them from active compliance tracking - handy for anyone who's left
          but whose training history you still want to keep.
        </p>
      </>
    )
  },
  {
    id: "requirements",
    title: "Requirements",
    content: (
      <>
        <p>
          The <strong>Requirements</strong> catalog is the list of certificate/training types CertiWatch recognizes
          (Food Safety, Moving &amp; Handling, Safeguarding, and so on). Most common ones are already built in. If
          your organization has a local requirement the seeded catalog doesn't cover, add it here - you can also jump
          here directly from the Review page with the name already filled in, if a document mentions a requirement
          type that doesn't exist yet.
        </p>
      </>
    )
  },
  {
    id: "devices",
    title: "Devices (local folder watching)",
    content: (
      <>
        <p>
          A <strong>Device</strong> is a small agent you install on a computer that has certificates saved locally -
          it watches a folder you choose and automatically uploads anything new that appears there, so nobody has to
          remember to log in and upload by hand. Go to <strong>Devices</strong> and follow the one-line install
          command for your enrollment code.
        </p>
        <p className="mt-3">
          Each device gets its own token, which only ever allows it to push documents in - removing a device from
          this page immediately and completely cuts off its access.
        </p>
      </>
    )
  },
  {
    id: "sources",
    title: "Sources (Google Drive & OneDrive)",
    content: (
      <>
        <p>
          <strong>Sources</strong> connects a cloud folder directly - no secret keys or technical setup. Click
          Connect Google Drive or Connect Microsoft OneDrive, sign in the normal way through Google/Microsoft's own
          screen, and grant read-only access. You'll only ever be asked for a folder ID (found in that folder's own
          web address) to tell CertiWatch which folder to watch.
        </p>
        <p className="mt-3">
          Because this uses a real sign-in rather than a pasted key, you can revoke access at any time from your own
          Google or Microsoft account settings - CertiWatch never sees your password, and only ever has the specific,
          narrow access you granted.
        </p>
        <p className="mt-3">
          New files typically show up within about a minute of being added to the connected folder. Status goes from
          &ldquo;checking…&rdquo; to &ldquo;ok&rdquo; automatically - there's nothing to refresh manually.
        </p>
      </>
    )
  },
  {
    id: "roles",
    title: "Roles: Admin, Manager, Viewer",
    content: (
      <>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Admin</strong> - full access: billing, staff, requirements, devices, sources, invites, and everything managers/viewers can do.</li>
          <li><strong>Manager</strong> - day-to-day compliance work (upload, review, records, compliance, staff) without access to billing or connector setup.</li>
          <li><strong>Viewer</strong> - read-only access to review, records, staff, and compliance - useful for auditors or anyone who needs visibility without the ability to change anything.</li>
        </ul>
        <p className="mt-3">Admins manage roles from the <strong>Invite</strong> page.</p>
      </>
    )
  },
  {
    id: "plan-billing",
    title: "Plan & billing",
    content: (
      <>
        <p>
          <strong>Manage plan</strong> shows your current usage against your plan's record limit, lets you change
          plans, and lists your billing history with downloadable invoices. If you're approaching your limit you'll
          see a notice here and on the dashboard - upgrading takes effect immediately and reveals any records that
          were hidden past the previous limit right away.
        </p>
      </>
    )
  },
  {
    id: "support",
    title: "Getting help",
    content: (
      <>
        <p>
          If something isn't working the way this page describes, or you're not sure why a specific document ended
          up somewhere unexpected, open a ticket from the <strong>Support</strong> page. Include the staff name or
          document filename involved where you can - it's the fastest way for us to look up exactly what happened.
        </p>
      </>
    )
  }
];

export default function DocumentationPage() {
  const [activeId, setActiveId] = useState(sections[0].id);

  const scrollTo = (id: string) => {
    setActiveId(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-4">
      <div className="cw-card p-4">
        <h1 className="text-lg font-semibold text-slate-900">Documentation</h1>
        <p className="text-sm text-slate-600">
          A plain-language guide to how CertiWatch works, section by section. If you get stuck, the{" "}
          <a href="/support" className="font-medium text-indigo-600 hover:text-indigo-700">
            Support
          </a>{" "}
          page is always the fastest way to reach us directly.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <nav className="cw-card h-fit p-3 lg:sticky lg:top-4">
          <ul className="space-y-1">
            {sections.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => scrollTo(s.id)}
                  className={`block w-full rounded-md px-3 py-1.5 text-left text-sm ${
                    activeId === s.id
                      ? "bg-indigo-50 font-semibold text-indigo-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {s.title}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="cw-card divide-y divide-slate-200 p-4">
          {sections.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-4 py-5 first:pt-0 last:pb-0">
              <h2 className="text-base font-semibold text-slate-900">{s.title}</h2>
              <div className="mt-2 text-sm leading-relaxed text-slate-700">{s.content}</div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
