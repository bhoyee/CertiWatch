"use client";

import { useEffect, useState } from "react";
import { postJson } from "@/lib/api";

// Mounted once (inside SiteFooter, which every page that shows a "Contact" link also renders)
// and opened from anywhere else via a plain DOM event - simpler than wiring a shared context
// through every page that uses SiteHeader, since header and footer are unrelated siblings with
// no shared parent state to lift this into.
export const OPEN_CONTACT_MODAL_EVENT = "open-contact-modal";

export function openContactModal() {
  window.dispatchEvent(new Event(OPEN_CONTACT_MODAL_EVENT));
}

type Status = "idle" | "sending" | "sent" | "error";

export function ContactModal() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot - real visitors never see or fill this
  const [renderedAt, setRenderedAt] = useState(0);

  useEffect(() => {
    const handler = () => {
      setOpen(true);
      setStatus("idle");
      setError("");
      // Timed from when the modal actually opens, not page load - a script driving a headless
      // browser that respects UI state would still open then submit near-instantly, which this
      // catches; someone just leaving the tab open for a while does not get flagged.
      setRenderedAt(Date.now());
    };
    window.addEventListener(OPEN_CONTACT_MODAL_EVENT, handler);
    return () => window.removeEventListener(OPEN_CONTACT_MODAL_EVENT, handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setError("");
    try {
      await postJson<{ ok: boolean }, Record<string, unknown>>("/api/contact", {
        name,
        email,
        message,
        website,
        renderedAtUnixMs: renderedAt
      });
      setStatus("sent");
    } catch (err: any) {
      setStatus("error");
      setError(err?.message ?? "Couldn't send that - please try again or email hello@certiwatch.com directly.");
    }
  };

  const close = () => setOpen(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={close}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-7 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {status === "sent" ? (
          <div className="text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#EDF5EF] text-[#1F6B45]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-7 w-7">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <h3 className="mt-4 font-[family-name:var(--font-display)] text-xl font-semibold text-[#1B1B16]">
              Message sent
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#6B6A61]">
              Thanks — we'll get back to you at <strong>{email}</strong> as soon as we can.
            </p>
            <button
              onClick={close}
              className="mt-6 w-full rounded-md bg-[#1F6B45] py-2.5 text-sm font-semibold text-white transition hover:bg-[#195939]"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="contact-modal-title" className="font-[family-name:var(--font-display)] text-xl font-semibold text-[#1B1B16]">
                  Get in touch
                </h3>
                <p className="mt-1 text-sm text-[#6B6A61]">Questions, a pilot request, anything else — we read every message.</p>
              </div>
              <button
                onClick={close}
                aria-label="Close"
                className="shrink-0 rounded-md p-1 text-[#8A8A7E] transition hover:bg-[#F5F3EE] hover:text-[#1B1B16]"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <form className="mt-5 space-y-4" onSubmit={submit}>
              {/* Honeypot - visually and semantically hidden from real visitors and screen readers,
                  but present in the DOM for a bot's blind form-fill to catch. Off-screen rather than
                  display:none, since some bots specifically skip display:none/visibility:hidden
                  fields. */}
              <div className="absolute -left-[9999px] top-auto h-0 w-0 overflow-hidden" aria-hidden="true">
                <label htmlFor="contact-website">Leave this field blank</label>
                <input
                  id="contact-website"
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="contact-name" className="block text-sm font-medium text-[#1B1B16]">
                  Name
                </label>
                <input
                  id="contact-name"
                  required
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-[#E5E0D2] bg-white px-3.5 py-2.5 text-sm text-[#1B1B16] placeholder:text-[#A8A69A] focus:border-[#1F6B45] focus:outline-none focus:ring-1 focus:ring-[#1F6B45]"
                  placeholder="Jordan Diaz"
                />
              </div>
              <div>
                <label htmlFor="contact-email" className="block text-sm font-medium text-[#1B1B16]">
                  Email
                </label>
                <input
                  id="contact-email"
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-[#E5E0D2] bg-white px-3.5 py-2.5 text-sm text-[#1B1B16] placeholder:text-[#A8A69A] focus:border-[#1F6B45] focus:outline-none focus:ring-1 focus:ring-[#1F6B45]"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label htmlFor="contact-message" className="block text-sm font-medium text-[#1B1B16]">
                  Message
                </label>
                <textarea
                  id="contact-message"
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="mt-1.5 w-full resize-none rounded-md border border-[#E5E0D2] bg-white px-3.5 py-2.5 text-sm text-[#1B1B16] placeholder:text-[#A8A69A] focus:border-[#1F6B45] focus:outline-none focus:ring-1 focus:ring-[#1F6B45]"
                  placeholder="What can we help with?"
                />
              </div>

              {status === "error" && (
                <div className="rounded-md border border-[#F0C9C3] bg-[#FBECEA] px-3.5 py-2.5 text-sm text-[#B3432B]">{error}</div>
              )}

              <button
                type="submit"
                disabled={status === "sending"}
                className="w-full rounded-md bg-[#1F6B45] py-2.5 text-sm font-semibold text-white transition hover:bg-[#195939] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === "sending" ? "Sending…" : "Send message"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
