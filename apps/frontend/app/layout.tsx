import "./globals.css";
import { ReactNode } from "react";
import { Sidebar } from "../components/Sidebar";
import { Providers } from "../components/Providers";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <Providers>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 p-8">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
