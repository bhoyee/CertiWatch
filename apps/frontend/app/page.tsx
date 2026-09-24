import type { Metadata } from "next";
import LandingPageClient from "./LandingPageClient";
import { faqs } from "./landingData";

// Split from the actual page content (LandingPageClient.tsx, a client component - it needs
// useState/useEffect to check for a session cookie) because Next.js only reads a `metadata`
// export from a server component. Keeping this file as the thin server wrapper is what lets the
// homepage carry real title/description/Open Graph/structured-data SEO metadata at all.
const SITE_URL = "https://certiwatch.com";
const TITLE = "CertiWatch — Staff Certificate & Compliance Tracking Software";
const DESCRIPTION =
  "CertiWatch automatically reads, tracks, and reminds you before staff certificates, DBS checks, First Aid, and training records expire. Built for care homes, construction, and hospitality teams who need to prove compliance, not just claim it.";

// Grounded in the actual buyer language this product targets (care homes, CQC-adjacent
// compliance, construction site safety, hospitality) rather than generic SaaS terms - Google
// hasn't used the keywords meta tag as a ranking signal since 2009, but it's included since some
// crawlers/directories still read it, and it costs nothing to be accurate here.
const KEYWORDS = [
  "staff certificate tracking software",
  "compliance tracking software",
  "certificate expiry tracking",
  "DBS check tracking software",
  "employee certification tracking",
  "training compliance software",
  "CQC compliance software",
  "care home compliance software",
  "construction site safety certificate tracking",
  "First Aid certificate tracking",
  "staff training record management",
  "automated certificate renewal reminders"
];

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  keywords: KEYWORDS,
  applicationName: "CertiWatch",
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "CertiWatch",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/landing/certificate-hero.png", width: 1200, height: 630, alt: "A CertiWatch compliance certificate, stamped Compliant" }]
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/landing/certificate-hero.png"]
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 }
  }
};

// Structured data (schema.org, as JSON-LD) - this is what lets Google show rich results (the FAQ
// accordion appearing directly in search) and is the same machine-readable shape an AI system
// crawling the page would parse to answer "what is CertiWatch" or "is there a tool that tracks
// staff certificates" accurately, rather than guessing from prose alone.
const softwareApplicationJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "CertiWatch",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: DESCRIPTION,
  url: SITE_URL,
  offers: [
    { "@type": "Offer", name: "Starter", price: "99", priceCurrency: "USD", description: "Up to 15 staff" },
    { "@type": "Offer", name: "Growth", price: "249", priceCurrency: "USD", description: "Up to 75 staff" },
    { "@type": "Offer", name: "Pro", price: "499", priceCurrency: "USD", description: "Unlimited staff" }
  ],
  audience: {
    "@type": "Audience",
    audienceType: "Care homes, construction firms, hospitality businesses"
  }
};

const faqPageJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: { "@type": "Answer", text: faq.answer }
  }))
};

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageJsonLd) }} />
      <LandingPageClient />
    </>
  );
}
