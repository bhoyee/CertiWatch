import type { MetadataRoute } from "next";

// Generates /sitemap.xml. Only the pages that are actually public and worth a search engine
// ranking - everything else (the dashboard, /platform, token-gated pages) is kept out of the
// crawl entirely by app/robots.ts, so listing them here would be pointless.
const SITE_URL = "https://certiwatch.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: SITE_URL, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/signup`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 }
  ];
}
