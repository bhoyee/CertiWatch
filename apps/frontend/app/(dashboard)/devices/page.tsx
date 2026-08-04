"use client";

import { useEffect, useState } from "react";
import { fetchJson, postJson } from "../../../lib/api";

type Device = {
  id: string;
  name: string;
  operatingSystem: string | null;
  status: string | number;
  enrolledAt: string;
  lastSeenAt: string | null;
};

type EnrollmentCode = {
  code: string;
  expiresAt: string;
};

const ONLINE_WINDOW_MS = 5 * 60 * 1000;

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<EnrollmentCode | null>(null);
  const [minting, setMinting] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = () => {
    fetchJson<Device[]>("/api/devices")
      .then(setDevices)
      .catch((err) => setError(err.message ?? "Failed to load devices"));
  };

  useEffect(() => {
    load();
  }, []);

  const mintCode = async () => {
    setMinting(true);
    setMintError(null);
    setCopied(false);
    try {
      const result = await postJson<EnrollmentCode, Record<string, never>>("/api/devices/enrollment-codes", {});
      setEnrollment(result);
    } catch (err: any) {
      setMintError(err?.message ?? "Failed to generate an enrollment code");
    } finally {
      setMinting(false);
    }
  };

  const copyCode = async () => {
    if (!enrollment) return;
    try {
      await navigator.clipboard.writeText(enrollment.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard access can be denied by the browser; the code is still visible to copy manually
    }
  };

  if (error) return <ErrorCard message={error} />;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4">
          <h1 className="text-lg font-semibold text-slate-900">Devices</h1>
          <p className="text-sm text-slate-600">
            A device is a local agent watching a folder on a staff machine or NAS for new certificates — this is how a
            local folder gets connected to CertiWatch.
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h2 className="text-md font-semibold text-slate-900">Enroll a device</h2>
          <p className="mt-1 text-sm text-slate-600">
            Generate a one-time enrollment code, then install the agent on the machine watching the folder (see{" "}
            <code className="rounded bg-slate-200 px-1 py-0.5 text-xs">docs/agent-install.md</code>) and paste the code
            in when it asks. Minting a new code revokes the previous one, and unused codes expire after 24 hours.
          </p>

          <button
            onClick={mintCode}
            disabled={minting}
            className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
          >
            {minting ? "Generating..." : "Generate enrollment code"}
          </button>
          {mintError && <p className="mt-2 text-sm text-rose-700">{mintError}</p>}

          {enrollment && (
            <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                Shown once — copy it now
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900">
                  {enrollment.code}
                </code>
                <button
                  onClick={copyCode}
                  className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="mt-2 text-xs text-amber-800">Expires {formatDate(enrollment.expiresAt)}.</p>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4">
          <h2 className="text-md font-semibold text-slate-900">Enrolled devices</h2>
          <p className="text-sm text-slate-600">Agents enrolled for this tenant.</p>
        </div>
        {!devices ? (
          <p className="text-sm text-slate-600">Loading devices...</p>
        ) : devices.length === 0 ? (
          <p className="text-sm text-slate-600">No devices enrolled yet — generate a code above to add one.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <Header>Name</Header>
                  <Header>OS</Header>
                  <Header>Status</Header>
                  <Header>Online</Header>
                  <Header>Enrolled</Header>
                  <Header>Last seen</Header>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {devices.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <Cell>{d.name}</Cell>
                    <Cell>{d.operatingSystem ?? "—"}</Cell>
                    <Cell className="capitalize">{formatStatus(d.status)}</Cell>
                    <Cell>
                      <OnlinePill lastSeenAt={d.lastSeenAt} />
                    </Cell>
                    <Cell>{formatDate(d.enrolledAt)}</Cell>
                    <Cell>{formatRelative(d.lastSeenAt)}</Cell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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

function OnlinePill({ lastSeenAt }: { lastSeenAt: string | null }) {
  const isOnline = !!lastSeenAt && Date.now() - new Date(lastSeenAt).getTime() <= ONLINE_WINDOW_MS;
  const styles = isOnline ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600";
  return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${styles}`}>{isOnline ? "Online" : "Offline"}</span>;
}

const DEVICE_STATUS_LABELS = ["Unknown", "Enrolled", "Suspended", "Offline"];

function formatStatus(status: string | number) {
  if (typeof status === "number") {
    return DEVICE_STATUS_LABELS[status] ?? "Unknown";
  }
  return status || "Unknown";
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const dt = new Date(value);
  return isNaN(dt.getTime()) ? "—" : dt.toLocaleString();
}

function formatRelative(value: string | null) {
  if (!value) return "Never";
  const dt = new Date(value);
  if (isNaN(dt.getTime())) return "—";

  const seconds = Math.round((Date.now() - dt.getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
      Failed to load devices: {message}
    </div>
  );
}
