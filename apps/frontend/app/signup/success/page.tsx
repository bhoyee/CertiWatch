import Link from "next/link";
import { display, body } from "@/lib/fonts";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export default function SignupSuccessPage() {
  return (
    <div className={`${display.variable} ${body.variable} font-[family-name:var(--font-body)] flex min-h-screen flex-col bg-[#FAF7F0] text-[#1B1B16]`}>
      <SiteHeader />
      <section className="flex flex-1 items-center justify-center px-6 py-20">
        <div className="max-w-md text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#EDF2EC] text-xl text-[#1F6B45]">
            ✓
          </span>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-[#1F6B45]">Payment successful</p>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-medium text-[#1B1B16]">
            You're all set.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-[#6B6A61]">
            Thanks for subscribing to CertiWatch. Your tenant is being provisioned right now — check your email for a
            magic link into the admin dashboard.
          </p>
          <Link
            href="/login"
            className="mt-8 inline-flex items-center justify-center rounded-md bg-[#1F6B45] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#195939]"
          >
            Go to login
          </Link>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
