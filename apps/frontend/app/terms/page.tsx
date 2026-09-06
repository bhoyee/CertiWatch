import Link from "next/link";
import { LogoMark } from "../../components/LogoMark";

export const metadata = { title: "Terms of Service — CertiWatch" };

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark className="h-8 w-8" />
            <span className="text-lg font-semibold text-slate-900">CertiWatch</span>
          </Link>
          <Link href="/login" className="text-sm font-medium text-blue-600 hover:underline">
            Back to login
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-bold text-slate-900">Terms of Service</h1>
        <p className="mt-1 text-sm text-slate-500">Last updated 6 September 2026</p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-slate-700">
          <Section title="1. Agreement to these terms">
            <p>
              These Terms of Service ("Terms") govern access to and use of CertiWatch, a compliance and certificate
              tracking service for care providers and similar organisations ("Service"), provided by CertiWatch
              ("we", "us"). By creating an account, accepting an invite, or otherwise using the Service, you agree to
              these Terms on behalf of yourself and, where applicable, the organisation you represent ("Tenant").
            </p>
          </Section>

          <Section title="2. What CertiWatch does">
            <p>
              CertiWatch lets an organisation upload staff certificates and documents, extracts key details (such as
              staff name, requirement type, issue and expiry dates) using automated and manual review, tracks
              compliance status against configurable requirement types, and sends reminders as certificates approach
              expiry. Each Tenant's data is logically separated from every other Tenant's.
            </p>
          </Section>

          <Section title="3. Accounts, roles, and invitations">
            <p>
              Access is granted by invitation from an Admin or Manager within a Tenant. Roles (Admin, Manager,
              Viewer) determine what a user can see and do. You're responsible for keeping your account's access
              secure, and for anything that happens under your account. An Admin may deactivate or remove a user's
              access at any time; a Staff record (used for compliance tracking) is separate from a login account and
              may exist with or without one.
            </p>
          </Section>

          <Section title="4. Your content">
            <p>
              You (or your Tenant) retain ownership of the documents, certificates, and staff data uploaded to the
              Service ("Content"). You grant us a limited licence to store, process, and display that Content solely
              to provide the Service - including automated extraction, OCR processing, and compliance matching. You're
              responsible for having the right to upload any Content you submit, including any personal data about
              staff members.
            </p>
          </Section>

          <Section title="5. Acceptable use">
            <p>You agree not to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Upload content you don't have the right to share, or that infringes someone else's rights;</li>
              <li>Attempt to access another Tenant's data, or circumvent role-based access controls;</li>
              <li>Use the Service to store or process data unrelated to legitimate compliance tracking;</li>
              <li>Interfere with the Service's operation (e.g. automated scraping, denial-of-service, reverse engineering).</li>
            </ul>
          </Section>

          <Section title="6. Subscriptions and billing">
            <p>
              Paid plans are billed in advance on a recurring basis through our payment processor (Stripe). Plan
              limits (such as record counts) are shown on the Manage Plan page. You can cancel at any time from that
              page; access continues until the end of the current billing period. Fees are non-refundable except
              where required by law.
            </p>
          </Section>

          <Section title="7. Data retention and deletion">
            <p>
              Content remains available to your Tenant for as long as your account is active. If a Tenant's account
              is closed, we retain data for a limited period to allow recovery before permanent deletion, consistent
              with our <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>.
            </p>
          </Section>

          <Section title="8. Availability and support">
            <p>
              We aim to keep the Service available and reliable, but we don't guarantee uninterrupted access.
              Scheduled maintenance and unplanned outages may occur. Support requests can be raised from the{" "}
              <Link href="/support" className="text-blue-600 hover:underline">
                Support page
              </Link>{" "}
              within the app.
            </p>
          </Section>

          <Section title="9. Limitation of liability">
            <p>
              CertiWatch is a tool to help track compliance - it does not replace your organisation's own regulatory
              or legal obligations, and automated extraction may occasionally misread a document (which is why a
              review queue exists). To the maximum extent permitted by law, we are not liable for indirect,
              incidental, or consequential damages arising from use of the Service, including missed renewal
              deadlines.
            </p>
          </Section>

          <Section title="10. Changes to these terms">
            <p>
              We may update these Terms from time to time. Material changes will be reflected by updating the "Last
              updated" date above. Continued use of the Service after a change constitutes acceptance of the revised
              Terms.
            </p>
          </Section>

          <Section title="11. Contact">
            <p>
              Questions about these Terms can be raised through the{" "}
              <Link href="/support" className="text-blue-600 hover:underline">
                Support page
              </Link>{" "}
              within the app.
            </p>
          </Section>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}
