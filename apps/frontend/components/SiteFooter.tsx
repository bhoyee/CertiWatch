"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function SiteFooter() {
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    setHasSession(document.cookie.includes("cw_session="));
  }, []);

  return (
    <footer id="contact" className="border-t border-white/10 bg-[#0E100C]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-[family-name:var(--font-display)] text-lg font-semibold italic text-[#F5F3EE]">
            CertiWatch
          </p>
          <p className="mt-1 text-sm text-[#8A8A7E]">Compliance-grade certificate tracking for SMB teams.</p>
        </div>
        <div className="flex flex-wrap items-center gap-5 text-sm">
          <Link href="mailto:hello@certiwatch.com" className="text-[#C9C7BC] transition hover:text-white">
            hello@certiwatch.com
          </Link>
          {hasSession ? (
            <Link href="/analytics" className="font-semibold text-[#4E9C74] hover:text-[#6FB98F]">
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link href="/signup" className="font-semibold text-[#4E9C74] hover:text-[#6FB98F]">
                Start trial
              </Link>
              <Link href="/login" className="text-[#C9C7BC] transition hover:text-white">
                Log in
              </Link>
            </>
          )}
        </div>
      </div>
    </footer>
  );
}
