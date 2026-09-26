"use client";

import { useState } from "react";

type Section = {
  id: string;
  title: string;
  content: React.ReactNode;
};

// Real screenshots of the actual app (captured against a seeded demo tenant, not mockups) so a
// reader can see what a section looks like instead of having to picture it from prose alone.
function DocScreenshot({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  return (
    <figure className="mt-4 overflow-hidden rounded-lg border border-slate-200">
      <img src={src} alt={alt} className="w-full" />
      <figcaption className="border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">{caption}</figcaption>
    </figure>
  );
}

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
        <DocScreenshot src="/docs/screenshots/dashboard.png" alt="The CertiWatch dashboard, showing plan usage, record counts, and upcoming expiries" caption="The dashboard once you're inside - a live overview of records, expiring certificates, and processing status." />
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
        <p className="mt-3">
          If a Google Drive or OneDrive folder is connected (see Sources below), files from the Upload page and
          staff upload links are saved straight into that folder instead of CertiWatch&apos;s own storage - see the
          Sources section for how that's chosen when both are connected.
        </p>
      </>
    )
  },
  {
    id: "what-can-be-read",
    title: "What CertiWatch can actually read",
    content: (
      <>
        <p className="font-semibold text-slate-900">File format and scan quality</p>
        <p className="mt-1">CertiWatch accepts <strong>PDF, PNG, JPG, and TIFF</strong> files. Within those, results are only as good as the scan:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>A clear, well-lit scan or photo reads reliably almost every time.</li>
          <li>Blurry photos, heavy glare, or a page photographed at an angle can still often be read, but are more likely to come back incomplete.</li>
          <li>Upside-down or sideways pages, handwriting instead of print, and very low-resolution scans are the most common causes of a poor read.</li>
        </ul>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <figure className="rounded-lg border border-slate-200 p-3">
            <img src="/docs/scan-quality-good.png" alt="A clear, well-lit, right-side-up certificate scan" className="w-full rounded-md border border-slate-100" />
            <figcaption className="mt-2 text-center text-xs font-semibold text-emerald-700">Good - clear, well-lit, right-side up</figcaption>
          </figure>
          <figure className="rounded-lg border border-slate-200 p-3">
            <img src="/docs/scan-quality-bad.png" alt="A blurry, angled, poorly-lit photo of the same certificate" className="w-full rounded-md border border-slate-100" />
            <figcaption className="mt-2 text-center text-xs font-semibold text-amber-700">Still often works - blurry, angled, dim lighting</figcaption>
          </figure>
        </div>

        <p className="mt-3">
          Importantly, a document CertiWatch isn't confident about is never silently guessed at or dropped - it's
          sent to <strong>Review</strong> with whatever it did manage to read already filled in, so a person only
          has to fix or confirm the parts it couldn't be sure of, not start from scratch.
        </p>

        <p className="mt-5 font-semibold text-slate-900">What kind of document, not just what kind of scan</p>
        <p className="mt-1">
          Getting the file format and scan quality right isn't enough on its own - the document also has to be the
          right <em>kind</em>. CertiWatch is built to track compliance for a specific, named staff member, so it
          only really makes sense for documents that belong to a person:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li><strong>Works well:</strong> training certificates, professional qualifications, DBS checks, licences, right-to-work documents, professional registrations - anything of the shape &ldquo;this person holds/completed X, issued by Y, valid until Z.&rdquo;</li>
          <li><strong>Doesn't fit the model:</strong> certificates about a building or the business itself - an EPC, a gas safety certificate, an electrical safety certificate, a fire risk assessment, an insurance policy. These have no staff member to attach to, so CertiWatch will still read text off them, but the result won't make sense - for example, a property occupant's name landing in the staff field instead of an actual employee.</li>
        </ul>
        <p className="mt-3">
          If one of these does get uploaded, it will still land in Review rather than being approved automatically -
          but it's worth not uploading them in the first place, since there's nothing meaningful for CertiWatch to
          extract from them.
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
        <DocScreenshot src="/docs/screenshots/review.png" alt="The Review queue, showing a flagged document alongside its extracted fields for a human to check" caption="The Review queue - the flagged item's list on the left, the original document and its extracted fields on the right." />
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
          Your plan's limit is counted in distinct requirements tracked (one staff member plus one requirement type -
          a training course, a DBS check, a right-to-work check, a professional registration, or anything else you're
          tracking), not raw documents - renewing something you already track is always free, only a new staff member
          or a newly-tracked requirement uses more of the allowance. If you're over your plan's limit, Records only
          shows your oldest tracked requirements up to that limit - the rest are still safely stored (nothing is
          deleted or lost), and all of them reappear automatically the moment you upgrade.
        </p>
        <DocScreenshot src="/docs/screenshots/records.png" alt="The Records page, listing processed certificates with staff name, requirement, issuer, dates, and status" caption="Records - every processed certificate in one sortable, searchable, exportable list." />
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
          one screen instead of hunting through individual records. <strong>Print report</strong> generates a
          dated, audit-ready summary you can hand straight to an inspector, and <strong>Export CSV</strong> gives
          you the same data as a flat register - one row per staff/requirement pair - for anything you need to work
          with outside CertiWatch.
        </p>
        <DocScreenshot src="/docs/screenshots/compliance.png" alt="The compliance matrix, showing every active staff member against every requirement with color-coded status" caption="The compliance matrix - staff down the side, requirements across the top, color-coded at a glance." />
        <DocScreenshot src="/docs/screenshots/compliance-report.png" alt="A generated compliance report, showing overall status and a breakdown by requirement" caption="The generated report from Print report - a dated summary ready to hand to an inspector." />
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
        <p className="mt-3">
          The <strong>Reminder timing</strong> card at the top of this page controls when expiry alerts go out for
          your whole organization - see <strong>Reminders</strong> below for details.
        </p>
        <DocScreenshot src="/docs/screenshots/requirements.png" alt="The Requirements page, showing reminder timing, manager visibility settings, and the requirement type catalog" caption="Requirements - reminder timing, manager visibility, and the full requirement catalog, all on one page." />
      </>
    )
  },
  {
    id: "reminders",
    title: "Reminders",
    content: (
      <>
        <p>
          CertiWatch sends two kinds of email: an <strong>expiry alert</strong> counting down to a specific
          record's deadline, and a <strong>weekly digest</strong> summarizing everything across your organization at
          once.
        </p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5">
          <li>
            <strong>Expiry alerts</strong> fire on a schedule of "days before expiry" - by default 60, 30, 7, and 1
            days out, so a lapsing certificate gets four separate warnings, not one easy-to-miss email. Admins can
            change this schedule for the whole organization from the <strong>Reminder timing</strong> card on the{" "}
            <strong>Requirements</strong> page - enter whole numbers separated by commas (1-365 days each, up to 8
            values), or use <strong>Reset to default</strong> to go back to 60/30/7/1. There's no per-requirement or
            per-person override yet - one schedule applies to everything you track.
          </li>
          <li>
            <strong>The weekly digest</strong> goes out every Monday morning and covers what's new, what's expiring
            in the next 30 days, what's already expired, and anything sitting in Review with low confidence. It goes
            to every admin and manager on the account, not just one person.
          </li>
        </ul>
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
        <DocScreenshot src="/docs/screenshots/devices.png" alt="The Devices page, showing the enrollment form and a list of connected devices with their status" caption="Devices - enroll a new agent, and see everything already connected and its last-seen status." />
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
          Connect Google Drive or Connect Microsoft OneDrive and sign in the normal way through Google/Microsoft's
          own screen. For Google Drive, you then pick the folder visually - CertiWatch only ever gets access to that
          one folder, never your whole Drive. For OneDrive, you'll be asked for a folder ID (found in that folder's
          own web address).
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
        <p className="mt-3">
          Unlike a local folder agent, CertiWatch never keeps a permanent copy of a file that came from a watched
          Google Drive or OneDrive folder - it reads the file from your own Drive when it needs to (to run
          extraction, or when you open it on the review screen or an export) and nothing is duplicated into our
          storage. If a file is later moved, renamed, or deleted in your Drive, or access is revoked, opening it in
          CertiWatch will fail even though the extracted record itself is unaffected.
        </p>
        <p className="mt-3">
          Once a Drive or OneDrive folder is connected, a staff upload link or the Upload page saves new files
          straight into that folder too, instead of CertiWatch&apos;s own storage - same reasoning as above, just in
          the other direction. If both are connected, Google Drive is used by default; the &ldquo;Where should
          direct uploads go?&rdquo; control on the Sources page lets an admin choose OneDrive instead. With neither
          connected, those files are archived on our own storage as before.
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
          <strong>Manage plan</strong> shows your current usage against your plan's tracked-requirement limit, lets
          you change plans, and lists your billing history with downloadable invoices. If you're approaching your
          limit you'll see a notice here and on the dashboard - upgrading takes effect immediately and reveals any
          records that were hidden past the previous limit right away.
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
