import Link from "next/link";
import { ReactNode } from "react";

const navItems = [
  { href: "/records", label: "Records" },
  { href: "/rules", label: "Rules" },
  { href: "/devices", label: "Devices" },
  { href: "/sources", label: "Sources" },
  { href: "/admin/invite", label: "Invite" },
  { href: "/logout", label: "Logout" }
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 flex-shrink-0 border-r border-slate-200 bg-white p-4 md:flex md:flex-col">
          <div className="mb-6 px-2">
            <Link href="/" className="text-lg font-bold text-slate-900">
              CertiWatch
            </Link>
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
