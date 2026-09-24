import type { MetadataRoute } from "next";

// Generates /robots.txt. The authenticated dashboard (everything under the (dashboard) route
// group - records, compliance, review, requirements, sources, etc.), the platform superadmin
// console, and raw API routes are disallowed: a crawler without a session cookie can't render
// anything useful there anyway, and there's no reason to spend crawl budget on pages that will
// only ever show an empty shell or a login redirect.
//
// AI crawlers are listed explicitly and allowed, not just left to fall under "*" - a lot of
// generic robots.txt templates block these by default, and the point of this pass is the
// opposite: an AI assistant asked "is there a tool that tracks staff certificates" should be able
// to read this site and mention CertiWatch accurately.
const AI_CRAWLERS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
  "Bytespider",
  "CCBot"
];

const DISALLOWED_PATHS = [
  "/api/",
  // Everything under the (dashboard) route group - a route group adds no URL segment, so these
  // are real top-level paths, verified against the actual app/ directory rather than guessed.
  "/admin/invite",
  "/analytics",
  "/compliance",
  "/devices",
  "/documentation",
  "/invite",
  "/notifications",
  "/plan",
  "/profile",
  "/records",
  "/requirements",
  "/review",
  "/sources",
  "/staff",
  "/support",
  "/uploads",
  // Platform superadmin console - an internal tool, not something worth being findable via search.
  "/platform",
  // Public but token-gated and worthless without one - indexing a generic, tokenless version of
  // these adds thin/broken-looking pages to search results for no benefit.
  "/logout",
  "/magic",
  "/upload",
  "/signup/success"
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOWED_PATHS },
      ...AI_CRAWLERS.map((userAgent) => ({ userAgent, allow: "/", disallow: DISALLOWED_PATHS }))
    ],
    sitemap: "https://certiwatch.com/sitemap.xml",
    host: "https://certiwatch.com"
  };
}
