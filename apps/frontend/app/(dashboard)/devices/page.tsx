"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "../../../lib/api";

type Device = {
  id: string;
  name: string;
  operatingSystem: string | null;
  status: string | number;
  lastSeenAt: string | null;
};

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<Device[]>("/api/devices")
      .then(setDevices)
      .catch((err) => setError(err.message ?? "Failed to load devices"));
  }, []);

  if (error) return <ErrorCard message={error} />;
  if (!devices) return <LoadingCard />;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-slate-900">Devices</h1>
        <p className="text-sm text-slate-600">Workers enrolled for this tenant.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <Header>Name</Header>
              <Header>OS</Header>
              <Header>Status</Header>
              <Header>Last seen</Header>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {devices.map((d) => (
              <tr key={d.id} className="hover:bg-slate-50">
                <Cell>{d.name}</Cell>
                <Cell>{d.operatingSystem ?? "—"}</Cell>
                <Cell className="capitalize">{String(d.status ?? "").toLowerCase() || "unknown"}</Cell>
                <Cell>{d.lastSeenAt ?? "—"}</Cell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Header({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">{children}</th>;
}

function Cell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 text-slate-800 ${className}`}>{children}</td>;
}

function LoadingCard() {
  return <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">Loading devices...</div>;
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
      Failed to load devices: {message}
    </div>
  );
}
