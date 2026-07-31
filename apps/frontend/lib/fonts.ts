import { Fraunces, Work_Sans } from "next/font/google";

// Shared brand typography: a serif with real character for headlines, paired with a clean
// humanist sans for everything else. Scoped per-page via these exported font objects rather than
// the root layout, so the rest of the (still Inter-based) app is unaffected.
export const display = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display"
});

export const body = Work_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body"
});
