"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Cookies from "js-cookie";
import { display, body } from "@/lib/fonts";

function IconShield() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
      <path d="M12 3.5 5 6.2v5.3c0 4.3 3 7.6 7 8.9 4-1.3 7-4.6 7-8.9V6.2L12 3.5Z" strokeLinejoin="round" />
      <path d="m9 12 2.2 2.2L15.5 10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconDevice() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
      <rect x="6" y="3.5" width="12" height="17" rx="2" />
      <path d="M11 17h2" strokeLinecap="round" />
    </svg>
  );
}

const trustPoints = [
  { icon: IconShield, text: "No password to leak — every login is a fresh, signed link." },
  { icon: IconClock, text: "Links expire in minutes. Sessions can too, once you close the tab." },
  { icon: IconDevice, text: "Sessions are tied to this device, not just this browser tab." }
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [fallbackEmail, setFallbackEmail] = useState("");
  const [rememberDevice, setRememberDevice] = useState(true);
  const [deviceId, setDeviceId] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5002", []);

  useEffect(() => {
    const existing = Cookies.get("cw_device");
    if (existing) {
      setDeviceId(existing);
      return;
    }
    const generated = crypto.randomUUID();
    setDeviceId(generated);
    Cookies.set("cw_device", generated, { expires: 365, sameSite: "lax" });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setError("");
    try {
      const res = await fetch(`${apiBase}/api/auth/magic-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          fallbackEmail: fallbackEmail || null,
          rememberDevice,
          deviceId: deviceId || null
        })
      });
      if (!res.ok) {
        const text = await res.text();
        try {
          const parsed = JSON.parse(text);
          throw new Error(parsed.friendlyError || parsed.error || "Failed to send magic link");
        } catch {
          throw new Error(text || "Failed to send magic link");
        }
      }
      setStatus("sent");
    } catch (err: any) {
      setStatus("error");
      setError(err.message ?? "Failed to send magic link");
    }
  };

  return (
    <div className={`${display.variable} ${body.variable} font-[family-name:var(--font-body)] grid min-h-screen md:grid-cols-2`}>
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-[#12140F] px-12 py-14 md:flex md:flex-col md:justify-between">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(#F5F3EE 1px, transparent 1px), linear-gradient(90deg, #F5F3EE 1px, transparent 1px)",
            backgroundSize: "48px 48px"
          }}
        />
        <Link href="/" className="relative font-[family-name:var(--font-display)] text-xl font-semibold italic text-[#F5F3EE]">
          CertiWatch
        </Link>

        <div className="relative max-w-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4E9C74]">Sign in</p>
          <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-medium leading-[1.15] text-[#F5F3EE]">
            No passwords. Just a link that proves it's you.
          </h1>
          <ul className="mt-8 space-y-4">
            {trustPoints.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm leading-relaxed text-[#C9C7BC]">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/5 text-[#4E9C74]">
                  <Icon />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-[#6B6A61]">© {new Date().getFullYear()} CertiWatch</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-[#FAF7F0] px-6 py-16">
        <div className="w-full max-w-sm">
          <Link
            href="/"
            className="mb-10 inline-flex font-[family-name:var(--font-display)] text-lg font-semibold italic text-[#1B1B16] md:hidden"
          >
            CertiWatch
          </Link>

          <h2 className="font-[family-name:var(--font-display)] text-2xl font-medium text-[#1B1B16]">Log in</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#6B6A61]">
            Enter your email and we'll send a sign-in link. Add a backup email if you want it delivered two places.
          </p>

          <form className="mt-8 space-y-5" onSubmit={submit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#1B1B16]">
                Email
              </label>
              <input
                id="email"
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-[#E5E0D2] bg-white px-3.5 py-2.5 text-sm text-[#1B1B16] placeholder:text-[#A8A69A] focus:border-[#1F6B45] focus:outline-none focus:ring-1 focus:ring-[#1F6B45]"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="fallback" className="block text-sm font-medium text-[#1B1B16]">
                Fallback email <span className="font-normal text-[#8A8A7E]">(optional)</span>
              </label>
              <input
                id="fallback"
                type="email"
                value={fallbackEmail}
                onChange={(e) => setFallbackEmail(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-[#E5E0D2] bg-white px-3.5 py-2.5 text-sm text-[#1B1B16] placeholder:text-[#A8A69A] focus:border-[#1F6B45] focus:outline-none focus:ring-1 focus:ring-[#1F6B45]"
                placeholder="admins@company.com"
              />
            </div>
            <label className="flex items-center gap-2.5 text-sm text-[#4B4A42]">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                className="h-4 w-4 rounded border-[#CBC7B6] accent-[#1F6B45] focus:ring-[#1F6B45]"
              />
              Stay signed in on this device
            </label>
            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full rounded-md bg-[#1F6B45] py-2.5 text-sm font-semibold text-white transition hover:bg-[#195939] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "loading" ? "Sending…" : "Send magic link"}
            </button>
          </form>

          {status === "sent" && (
            <div className="mt-5 flex items-start gap-2.5 rounded-md border border-[#CFE3D6] bg-[#EDF5EF] px-3.5 py-3 text-sm text-[#1F6B45]">
              <span className="mt-0.5">✓</span>
              <span>
                Sent! Check your inbox{fallbackEmail ? ` (and ${fallbackEmail})` : ""}.
              </span>
            </div>
          )}
          {status === "error" && (
            <div className="mt-5 rounded-md border border-[#F0C9C3] bg-[#FBECEA] px-3.5 py-3 text-sm text-[#B3432B]">
              {error}
            </div>
          )}

          <p className="mt-8 text-sm text-[#6B6A61]">
            New here?{" "}
            <Link href="/signup" className="font-semibold text-[#1F6B45] hover:text-[#195939]">
              Start a 7-day trial
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
