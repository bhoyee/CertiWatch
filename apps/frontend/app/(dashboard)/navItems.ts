// Ordered by priority/need rather than alphabetically or by when each feature was added:
// overview first, then whatever demands action today (Uploads is the app's main CTA; Review
// carries a live "needs attention" badge), then the core daily workflow (Records, Compliance,
// Staff, Support), then occasional admin/config screens nobody opens daily, and finally the
// account-level items (docs, billing, profile, logout) that always sit at the bottom of a sidebar,
// set off from the rest with their own visual gap (see the `divider` flag, rendered in layout.tsx).
export const navItems = [
  { href: "/platform/tenants", label: "Platform", icon: "shield", superOnly: true },
  { href: "/platform/support", label: "Platform Support", icon: "life-buoy", superOnly: true },
  { href: "/platform/billing", label: "Platform Billing", icon: "credit", superOnly: true },
  { href: "/platform/usage", label: "Platform Usage", icon: "chart", superOnly: true },
  { href: "/platform/security", label: "Platform Security", icon: "shield-check", superOnly: true },

  { href: "/analytics", label: "Analytics", icon: "chart" },
  { href: "/uploads", label: "Uploads", icon: "cloud" },
  { href: "/review", label: "Review", icon: "flag", viewerHidden: true },
  { href: "/records", label: "Records", icon: "table" },
  { href: "/compliance", label: "Compliance", icon: "table", viewerHidden: true },
  { href: "/staff", label: "Staff", icon: "users", viewerHidden: true },
  { href: "/support", label: "Support", icon: "life-buoy" },

  { href: "/requirements", label: "Requirements", icon: "shield", viewerHidden: true, managerHidden: true },
  { href: "/devices", label: "Devices", icon: "cpu", viewerHidden: true, managerHidden: true },
  { href: "/sources", label: "Sources", icon: "plug", viewerHidden: true, managerHidden: true },
  { href: "/invite", label: "Invite", icon: "users", viewerHidden: true },

  { href: "/documentation", label: "Documentation", icon: "book", divider: true },
  { href: "/plan", label: "Manage plan", icon: "credit", viewerHidden: true, managerHidden: true },
  { href: "/profile", label: "Profile", icon: "user" },
  { href: "/logout", label: "Logout", icon: "exit" }
];
