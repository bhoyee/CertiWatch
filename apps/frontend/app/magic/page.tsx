"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Cookies from "js-cookie";

export default function MagicPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm text-slate-600">Verifying your magic link…</p>
          </div>
        </div>
      }
    >
      <MagicVerifier />
    </Suspense>
  );
}

function MagicVerifier() {
  const search = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const token = search.get("token");
    if (!token) return;

    const verify = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5002"}/api/auth/magic-link/verify?token=${encodeURIComponent(
            token
          )}`
        );
        if (!res.ok) {
          throw new Error("Invalid or expired link");
        }
        Cookies.set("cw_session", token, { expires: 7, sameSite: "lax" });
        router.replace("/records");
      } catch {
        router.replace("/login");
      }
    };

    verify();
  }, [router, search]);

  return null;
}
