"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchJson, postJson } from "../../../lib/api";

type Device = {
  id: string;
  name: string;
  operatingSystem: string | null;
  status: string | number;
  enrolledAt: string;
  lastSeenAt: string | null;
  watchPaths: string[];
};

type EnrollmentCode = {
  code: string;
  expiresAt: string;
};

type Os = "linux" | "macos" | "windows";

const ONLINE_WINDOW_MS = 5 * 60 * 1000;
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5002";

function detectOs(): Os {
  if (typeof navigator === "undefined") return "linux";
  const platform = `${navigator.userAgent} ${navigator.platform ?? ""}`.toLowerCase();
  if (platform.includes("win")) return "windows";
  if (platform.includes("mac")) return "macos";
  return "linux";
}

const PATH_PLACEHOLDERS: Record<Os, string> = {
  windows: "C:\\CertiWatch\\Watch",
  linux: "/mnt/certificates",
  macos: "/Volumes/CertiWatch"
};

function installCommand(os: Os, code: string, folderPath: string): string {
  if (os === "windows") {
    return `$s = irm ${API_BASE}/api/devices/install.ps1; & ([scriptblock]::Create($s)) -Code '${code}' -Path '${folderPath}' -Name $env:COMPUTERNAME`;
  }
  return `curl -fsSL ${API_BASE}/api/devices/install.sh | sudo bash -s -- --code ${code} --path "${folderPath}" --name "$(hostname)"`;
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<EnrollmentCode | null>(null);
  const [minting, setMinting] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [commandCopied, setCommandCopied] = useState(false);
  const [os, setOs] = useState<Os>("linux");
  const [folderPath, setFolderPath] = useState("");

  useEffect(() => {
    setOs(detectOs());
  }, []);

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

  const command = useMemo(
    () => (enrollment && folderPath.trim() ? installCommand(os, enrollment.code, folderPath.trim()) : ""),
    [os, enrollment, folderPath]
  );

  const copyCommand = async () => {
    if (!command) return;
    try {
      await navigator.clipboard.writeText(command);
      setCommandCopied(true);
      setTimeout(() => setCommandCopied(false), 2000);
    } catch {
      // clipboard access can be denied by the browser; the command is still visible to copy manually
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
            Tell it which folder to watch, then generate a one-time code — the install command below will have
            both baked in. Minting a new code revokes the previous one, and unused codes expire after 24 hours.
          </p>

          <div className="mt-3 max-w-md">
            <label className="text-sm font-medium text-slate-700">Folder to watch</label>
            <input
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              placeholder={PATH_PLACEHOLDERS[os]}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-500">
              The full path on the machine running the agent — a local folder, a mapped drive, or a NAS mount.
              Created automatically if it doesn't exist yet.
            </p>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              onClick={mintCode}
              disabled={minting}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
            >
              {minting ? "Generating..." : "Generate enrollment code"}
            </button>
            <Link href="/devices/install" className="text-sm font-medium text-blue-600 hover:underline">
              How do I install the agent?
            </Link>
          </div>
          {mintError && <p className="mt-2 text-sm text-rose-700">{mintError}</p>}

          {enrollment && (
            <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                Shown once — run this on the machine watching the folder
              </p>

              <div className="mt-2 flex gap-1">
                {(["linux", "macos", "windows"] as Os[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setOs(tab)}
                    className={`rounded-md px-3 py-1 text-xs font-semibold ${
                      os === tab ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {tab === "linux" ? "Linux" : tab === "macos" ? "macOS" : "Windows"}
                  </button>
                ))}
              </div>

              {!command ? (
                <p className="mt-2 rounded-lg border border-dashed border-amber-400 bg-white p-3 text-xs text-amber-800">
                  Enter a folder to watch above to generate the install command.
                </p>
              ) : (
                <>
                  <div className="relative mt-2">
                    <button
                      onClick={copyCommand}
                      className="absolute right-2 top-2 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                    >
                      {commandCopied ? "Copied" : "Copy"}
                    </button>
                    <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 pr-16 text-xs text-slate-100">
                      <code>{command}</code>
                    </pre>
                  </div>
                  {os === "windows" && (
                    <p className="mt-1 text-xs text-amber-800">Run in PowerShell as Administrator.</p>
                  )}
                  {os !== "windows" && <p className="mt-1 text-xs text-amber-800">Runs with sudo — registers a system service.</p>}
                </>
              )}

              <p className="mt-3 text-xs text-amber-800">
                Expires {formatDate(enrollment.expiresAt)}. Raw code:{" "}
                <code className="rounded bg-white px-1 py-0.5 font-mono">{enrollment.code}</code>{" "}
                <button onClick={copyCode} className="font-semibold underline">
                  {copied ? "Copied" : "copy"}
                </button>
              </p>
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
                  <Header>Watching</Header>
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
                    <Cell>
                      {d.watchPaths.length === 0 ? (
                        <span className="text-slate-400">Not reported yet</span>
                      ) : (
                        <span className="font-mono text-xs">{d.watchPaths.join(", ")}</span>
                      )}
                    </Cell>
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
