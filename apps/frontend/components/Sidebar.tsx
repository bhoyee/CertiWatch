'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const links = [
  { href: "/", label: "Overview" },
  { href: "/records", label: "Records" },
  { href: "/rules", label: "Rules" },
  { href: "/devices", label: "Devices" },
  { href: "/sources", label: "Sources" }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 border-r bg-white p-6 shadow-sm md:block">
      <div className="mb-6">
        <p className="text-xs uppercase text-slate-400">CertiWatch</p>
        <p className="text-lg font-semibold text-slate-900">Silent Auditor</p>
      </div>
      <nav className="space-y-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={clsx(
              "block rounded-md px-3 py-2 text-sm font-medium",
              pathname === link.href
                ? "bg-slate-100 text-slate-900"
                : "text-slate-500 hover:bg-slate-50"
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
