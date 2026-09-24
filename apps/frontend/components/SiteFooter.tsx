"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ContactModal, openContactModal } from "./ContactModal";

// Same faint grid texture as the hero and final-CTA dark panels elsewhere on the page - the
// footer bookends the same visual rhythm instead of abruptly becoming a plain, generic dark bar
// once the marketing content ends.
const FOOTER_GRID_TEXTURE = {
  backgroundImage: "linear-gradient(#F5F3EE 1px, transparent 1px), linear-gradient(90deg, #F5F3EE 1px, transparent 1px)",
  backgroundSize: "48px 48px"
};

// Same four sectors, same hue per sector, as the trust-strip badges near the top of the page -
// recolored for a dark ground instead of introducing a second, unrelated badge style.
const industries = [
  { name: "Care homes", classes: "bg-[#1F6B45]/20 text-[#8FBBA2]" },
  { name: "Construction", classes: "bg-[#A15A2A]/20 text-[#E3A575]" },
  { name: "Hospitality", classes: "bg-[#8A3E63]/20 text-[#D890AE]" },
  { name: "Facilities", classes: "bg-[#2F5D82]/20 text-[#8FBEE0]" }
];

const productLinks = [
  { href: "/#how", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" }
];

export function SiteFooter() {
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    setHasSession(document.cookie.includes("cw_session="));
  }, []);

  return (
    <footer className="relative overflow-hidden border-t border-white/10 bg-[#0E100C]">
      <div className="pointer-events-none absolute inset-0 opacity-[0.05]" style={FOOTER_GRID_TEXTURE} />

      <div className="relative mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr]">
          {/* Brand - the one column that couldn't belong to any other SaaS footer: the same
              wordmark, mission line, and sector badges established at the top of this same
              page, not a generic "About us" blurb. */}
          <div>
            <Link href="/" className="font-[family-name:var(--font-display)] text-xl font-semibold italic text-[#F5F3EE]">
              CertiWatch
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-[#8A8A7E]">
              Watches every folder and cloud drive your staff certificates land in, reads the expiry off the page,
              and tells you before it runs out.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {industries.map((industry) => (
                <span key={industry.name} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${industry.classes}`}>
                  {industry.name}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6B6A61]">Product</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {productLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-[#C9C7BC] transition hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/signup" className="text-[#C9C7BC] transition hover:text-white">
                  Start 7-day trial
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6B6A61]">Company</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <button onClick={openContactModal} className="text-[#C9C7BC] transition hover:text-white">
                  Contact us
                </button>
              </li>
              <li>
                <Link href="mailto:hello@certiwatch.com" className="text-[#C9C7BC] transition hover:text-white">
                  hello@certiwatch.com
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-[#C9C7BC] transition hover:text-white">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-[#C9C7BC] transition hover:text-white">
                  Privacy Policy
                </Link>
              </li>
              {hasSession && (
                <li>
                  <Link href="/analytics" className="font-semibold text-[#4E9C74] transition hover:text-[#6FB98F]">
                    Go to dashboard
                  </Link>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-[#6B6A61] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} CertiWatch. All rights reserved.</p>
          <p>Built for teams that can&apos;t afford to guess.</p>
        </div>
      </div>

      <ContactModal />
    </footer>
  );
}
