"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function SiteHeader() {
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    setHasSession(document.cookie.includes("cw_session="));
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#12140F]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="font-[family-name:var(--font-display)] text-lg font-semibold italic tracking-tight text-[#F5F3EE]"
        >
          CertiWatch
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-[#C9C7BC] md:flex">
          <Link href="/#how" className="transition hover:text-white">
            How it works
          </Link>
          <Link href="/#pricing" className="transition hover:text-white">
            Pricing
          </Link>
          <Link href="/#faq" className="transition hover:text-white">
            FAQ
          </Link>
          <Link href="/#contact" className="transition hover:text-white">
            Contact
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          {hasSession ? (
            <Link
              href="/analytics"
              className="inline-flex items-center justify-center rounded-md bg-[#1F6B45] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#195939]"
            >
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden text-sm font-medium text-[#C9C7BC] transition hover:text-white md:inline-flex"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-md bg-[#1F6B45] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#195939]"
              >
                Start 7-day trial
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
