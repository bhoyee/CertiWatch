"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

type NavItem = {
  href: string;
  label: string;
};

const navItems: NavItem[] = [
  { href: "/platform", label: "Overview" },
  { href: "/platform/tenants", label: "Tenants" },
  { href: "/platform/billing", label: "Billing" },
  { href: "/platform/usage", label: "Usage & Health" },
  { href: "/platform/support", label: "Support" },
  { href: "/platform/security", label: "Security" },
  { href: "/platform/settings", label: "Settings" },
];

export default function PlatformLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname() || "";
  const year = new Date().getFullYear();
  const activeSection =
    navItems.find((n) => pathname.startsWith(n.href))?.label ??
    "Platform Console";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-4 py-5 border-b border-slate-200">
          <div className="text-xl font-bold text-slate-900">CertiWatch</div>
          <p className="text-xs text-slate-500 mt-1">Platform Console</p>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-1">
          {navItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? "bg-blue-50 text-blue-700 border border-blue-100"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white shadow-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Platform
            </p>
            <h1 className="text-lg font-semibold text-slate-900">
              {activeSection}
            </h1>
          </div>
          <Link
            href="/logout"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Logout
          </Link>
        </header>

        <main className="flex-1 p-6">{children}</main>

        <footer className="px-6 py-4 border-t border-slate-200 bg-white text-sm text-slate-500 flex items-center justify-between">
          <div>© {year} CertiWatch Platform</div>
          <div className="space-x-4">
            <Link
              href="/platform/support"
              className="hover:text-slate-900 transition-colors"
            >
              Support
            </Link>
            <Link
              href="/platform/security"
              className="hover:text-slate-900 transition-colors"
            >
              Security
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}

