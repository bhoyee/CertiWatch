"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    Cookies.remove("cw_session");
    router.replace("/login");
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm text-slate-600">Signing you out…</p>
      </div>
    </div>
  );
}
