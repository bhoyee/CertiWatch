"use client";

import { useId } from "react";

// Shield + checkmark mark: compliance ("shield") that's been verified ("check"). Used standalone
// in app headers/sidebars; app/icon.svg carries a boxed variant of the same shape for the favicon.
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  // The gradient id must be unique per instance - this component renders more than once per page
  // (e.g. the desktop sidebar logo stays in the DOM, just CSS-hidden, alongside the mobile one),
  // and duplicate SVG ids break gradient fill resolution in some browsers.
  const gradientId = `cw-logo-gradient-${useId()}`;
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M12 2.4 4.6 5.3v5.4c0 5.1 3.2 9.1 7.4 10.5 4.2-1.4 7.4-5.4 7.4-10.5V5.3L12 2.4Z"
        fill={`url(#${gradientId})`}
      />
      <path
        d="M8.4 12.2l2.6 2.6 5.1-5.3"
        stroke="white"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id={gradientId} x1="4.6" y1="2.4" x2="19.4" y2="21.2" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366F1" />
          <stop offset="1" stopColor="#3B82F6" />
        </linearGradient>
      </defs>
    </svg>
  );
}
