"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Cookies from "js-cookie";

export default function PlatformMagicPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm text-slate-600">Verifying your platform link…</p>
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
          `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5002"}/api/platform/auth/magic-link/verify?token=${encodeURIComponent(
            token
          )}`
        );
        if (!res.ok) throw new Error("Invalid or expired link");
        const body = await res.json();
        const expiresAt = new Date(body.expiresAt);
        const now = Date.now();
        const msUntilExpiry = Math.max(0, expiresAt.getTime() - now);
        const days = Math.max(1, msUntilExpiry / (1000 * 60 * 60 * 24));
        Cookies.set("cw_session", body.token, { expires: days, sameSite: "lax" });
        if (body.deviceId) {
          Cookies.set("cw_device", body.deviceId, { expires: 365, sameSite: "lax" });
        }
        router.replace("/platform/tenants");
      } catch {
        router.replace("/platform/login");
      }
    };

    verify();
  }, [router, search]);

  return null;
}
