// Shared between page.tsx (server - reads this for FAQPage structured data) and
// LandingPageClient.tsx (renders it as the visible FAQ accordion) - one source of truth so the
// schema.org markup search engines/AI crawlers read can never drift from what a visitor actually
// sees on the page.
export const faqs = [
  {
    question: "How does onboarding work?",
    answer:
      "Pick a plan, complete Stripe checkout, and your tenant is provisioned automatically. Add your staff, enroll a device or connect Google Drive/OneDrive, and start ingesting documents right away."
  },
  {
    question: "Where are documents stored?",
    answer:
      "For anything that comes from a connected Google Drive or OneDrive folder, we don't keep a copy at all — CertiWatch reads the file from your own Drive whenever it's needed (to run OCR, or when you open it on the review screen) and never duplicates it into our storage. Access is limited to the specific folder you choose, never your whole Drive or OneDrive account. A staff upload link or the Upload page saves new files straight into that same connected folder too, once one is set up — Google Drive by default if both are connected, OneDrive if you choose it. Without either connected, or for a local folder agent, we keep a secure archived copy instead — encrypted in transit and at rest — since there's no cloud original to read back from later; nothing is deleted from wherever you originally dropped it either way."
  },
  {
    question: "What documents does it actually read reliably?",
    answer:
      "Person-specific certificates, qualifications, licences, and DBS checks — anything with a named individual, an issuer, and a date. It's not built for property or business paperwork like an EPC or a gas safety certificate; see the in-app documentation for the full picture."
  },
  {
    question: "Do you support trials?",
    answer:
      "Yes — a 7-day trial, card required up front. One trial per customer; billing begins automatically on day 7 unless you cancel first."
  }
];
