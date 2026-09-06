import Link from "next/link";
import { LogoMark } from "../../components/LogoMark";

export const metadata = { title: "Privacy Policy — CertiWatch" };

export default function PrivacyPage() {
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
        <h1 className="text-2xl font-bold text-slate-900">Privacy Policy</h1>
        <p className="mt-1 text-sm text-slate-500">Last updated 6 September 2026</p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-slate-700">
          <Section title="1. Overview">
            <p>
              CertiWatch helps care providers and similar organisations track staff certificates and compliance
              requirements. Because that involves personal data about staff members - including, in some cases,
              sensitive certificate details such as DBS or medical training status - we take data protection
              seriously. This policy explains what we collect, why, and how it's protected.
            </p>
          </Section>

          <Section title="2. What we collect">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <span className="font-medium text-slate-900">Account data</span> - name and email address for anyone
                invited to a Tenant, and their assigned role.
              </li>
              <li>
                <span className="font-medium text-slate-900">Staff records</span> - name, job title, and start date
                for staff being tracked for compliance, which may be entered manually or imported via CSV.
              </li>
              <li>
                <span className="font-medium text-slate-900">Uploaded documents</span> - certificates and related
                files uploaded for processing, along with data extracted from them (issuer, issue/expiry dates,
                requirement type, and an automated confidence score).
              </li>
              <li>
                <span className="font-medium text-slate-900">Usage and audit data</span> - login timestamps, actions
                taken in the app (e.g. record edits, invites sent), and device identifiers used to manage session
                length.
              </li>
              <li>
                <span className="font-medium text-slate-900">Billing data</span> - for paid plans, subscription and
                payment status is handled by our payment processor (Stripe); we do not store full card details
                ourselves.
              </li>
            </ul>
          </Section>

          <Section title="3. How we use it">
            <p>
              Data is used to operate the Service: authenticating logins, extracting and matching certificate data
              against requirement types, computing compliance status, sending expiry reminder emails and in-app
              notifications, and maintaining an audit trail of changes. We do not sell personal data, and we do not
              use Tenant data to train third-party AI models.
            </p>
          </Section>

          <Section title="4. Storage and security">
            <p>
              Each Tenant's data is logically isolated from every other Tenant's. Access to a Tenant's data is
              restricted by role (Admin, Manager, Viewer), and administrative actions are recorded in an audit log.
              Uploaded documents and extracted data are stored in access-controlled infrastructure. No system is
              perfectly secure, but we apply reasonable technical and organisational measures appropriate to the
              sensitivity of the data involved.
            </p>
          </Section>

          <Section title="5. Third parties we use">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <span className="font-medium text-slate-900">Email delivery</span> - to send login links, invites,
                and expiry reminders.
              </li>
              <li>
                <span className="font-medium text-slate-900">OCR / document processing</span> - to extract text and
                key fields from uploaded certificates.
              </li>
              <li>
                <span className="font-medium text-slate-900">Stripe</span> - to process subscription payments for
                paid plans.
              </li>
            </ul>
            <p className="mt-2">
              These providers process data only as needed to perform their function on our behalf, and are not
              permitted to use it for their own purposes.
            </p>
          </Section>

          <Section title="6. Data retention">
            <p>
              Data is retained for as long as a Tenant's account is active. Deleted records and staff members are
              removed from active views immediately; underlying data is purged from backups on a rolling schedule.
              If a Tenant's account is closed, we retain data briefly to allow recovery before permanent deletion.
            </p>
          </Section>

          <Section title="7. Your rights">
            <p>
              Depending on your role, you can access, correct, or delete records directly within the app (Staff,
              Records, and Invite pages all support editing and deletion). If you need help exporting or deleting
              data beyond what the app exposes - including a full account or staff-member erasure request - raise it
              through the{" "}
              <Link href="/support" className="text-blue-600 hover:underline">
                Support page
              </Link>
              , and your Tenant's Admin will typically need to confirm the request.
            </p>
          </Section>

          <Section title="8. Cookies and sessions">
            <p>
              CertiWatch uses a session cookie to keep you signed in after clicking a login link, and a device
              identifier so a "remembered" session can last longer on a trusted device. We don't use third-party
              advertising or tracking cookies.
            </p>
          </Section>

          <Section title="9. Children's data">
            <p>
              CertiWatch is intended for use by adults managing workplace compliance, and is not directed at
              children. Staff records may relate to adult employees only.
            </p>
          </Section>

          <Section title="10. Changes to this policy">
            <p>
              We may update this policy from time to time. Material changes will be reflected by updating the "Last
              updated" date above.
            </p>
          </Section>

          <Section title="11. Contact">
            <p>
              Questions about this policy, or requests relating to your data, can be raised through the{" "}
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
