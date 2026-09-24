import "./globals.css";
import { ReactNode } from "react";
import type { Metadata } from "next";
import { Providers } from "../components/Providers";

// Applies to every route that doesn't set its own metadata (most of the authenticated dashboard,
// which is "use client" throughout and so can't export metadata itself). Indexable by default -
// the actually-private routes are kept out of search engines via app/robots.ts instead, which
// stops them from being fetched at all rather than relying on every one of them remembering to
// opt out individually.
export const metadata: Metadata = {
  metadataBase: new URL("https://certiwatch.com"),
  title: {
    default: "CertiWatch — Staff Certificate & Compliance Tracking Software",
    template: "%s · CertiWatch"
  },
  description:
    "CertiWatch automatically reads, tracks, and reminds you before staff certificates, DBS checks, and training records expire — built for care homes, construction, and hospitality teams.",
  robots: { index: true, follow: true }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen text-slate-900">
        <Providers>
          <main className="min-h-screen">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
