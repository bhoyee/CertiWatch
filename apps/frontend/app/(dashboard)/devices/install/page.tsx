"use client";

import { useState } from "react";
import Link from "next/link";

type Os = "windows" | "linux" | "macos";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5002";

const osTabs: { value: Os; label: string }[] = [
  { value: "windows", label: "Windows" },
  { value: "linux", label: "Linux" },
  { value: "macos", label: "macOS" }
];

export default function AgentInstallPage() {
  const [os, setOs] = useState<Os>("windows");

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <Link href="/devices" className="text-sm font-medium text-blue-600 hover:underline">
          &larr; Back to Devices
        </Link>
        <div className="mt-2">
          <h1 className="text-lg font-semibold text-slate-900">Install the CertiWatch Agent</h1>
          <p className="mt-1 text-sm text-slate-600">
            The agent is a small background service that watches a folder on a staff machine or NAS for new
            certificate files and uploads them to CertiWatch. The existing OCR pipeline handles reading them —
            the agent itself only detects and uploads.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <h2 className="text-md font-semibold text-slate-900">The quick way: one command, nothing to build</h2>
        <p className="mt-1 text-sm text-slate-700">
          From the{" "}
          <Link href="/devices" className="font-medium text-blue-600 hover:underline">
            Devices page
          </Link>
          , click <span className="font-medium">Generate enrollment code</span>. That panel shows a single
          copy-paste command with the code already filled in — download the agent, install it as a service, and
          start it, all in one step. No SDK, no source checkout, no manual configuration.
        </p>
        <p className="mt-2 text-xs text-slate-600">
          The installer isn't code-signed yet, so Windows/macOS may show an "unknown publisher" warning the first
          time — that's expected for now, not a sign anything's wrong.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-md font-semibold text-slate-900">What happens next</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>The agent enrolls once using the code, then authenticates with its own device token from then on — restarting the service later never re-enrolls or creates a duplicate device.</li>
          <li>New or changed files in the watched folder(s) are detected within seconds; a 60-second re-scan catches anything missed and retries anything that failed to upload.</li>
          <li>Only .pdf, .png, .jpg, and .jpeg files up to 20MB are picked up.</li>
          <li>
            Once uploaded, records appear on the{" "}
            <Link href="/records" className="font-medium text-blue-600 hover:underline">
              Records page
            </Link>{" "}
            as Pending, then fill in with extracted fields once OCR finishes.
          </li>
          <li>
            The{" "}
            <Link href="/devices" className="font-medium text-blue-600 hover:underline">
              Devices page
            </Link>{" "}
            shows Online/Offline based on the agent's heartbeat, sent every 60 seconds.
          </li>
        </ul>
      </div>

      <details className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <summary className="cursor-pointer text-md font-semibold text-slate-900">
          Advanced: build from source / manual configuration
        </summary>
        <div className="mt-4 space-y-4">
          <p className="text-sm text-slate-600">
            Only needed if you're on an unsupported OS/architecture, or want to build and configure the agent
            yourself instead of using the one-line installer above.
          </p>

          <div>
            <p className="text-sm text-slate-600">
              The agent reads its settings from environment variables, prefixed with{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">Agent__</code> (a double underscore —
              standard .NET configuration binding, not a typo) — or from a single{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">agent.settings.json</code> file next to the
              binary, which is what the one-line installer writes for you.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <Header>Variable</Header>
                    <Header>Required</Header>
                    <Header>Value</Header>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <Cell mono>Agent__ApiBaseUrl</Cell>
                    <Cell>Yes</Cell>
                    <Cell mono>{API_BASE}</Cell>
                  </tr>
                  <tr>
                    <Cell mono>Agent__EnrollmentCode</Cell>
                    <Cell>Yes (first run only)</Cell>
                    <Cell>An enrollment code — only needed until the agent enrolls and saves its device credentials</Cell>
                  </tr>
                  <tr>
                    <Cell mono>Agent__DeviceName</Cell>
                    <Cell>No</Cell>
                    <Cell>Defaults to the machine's hostname</Cell>
                  </tr>
                  <tr>
                    <Cell mono>Agent__WatchPaths__0</Cell>
                    <Cell>No</Cell>
                    <Cell>Folder to watch. Defaults to the user's Documents folder</Cell>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="flex gap-2 border-b border-slate-200">
              {osTabs.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setOs(tab.value)}
                  className={`rounded-t-md px-4 py-2 text-sm font-semibold ${
                    os === tab.value
                      ? "border border-b-0 border-slate-200 bg-white text-slate-900"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="pt-4">{renderInstructions(os)}</div>
          </div>
        </div>
      </details>
    </div>
  );
}

function renderInstructions(os: Os) {
  if (os === "windows") {
    return (
      <CodeBlock
        code={[
          '$env:Agent__ApiBaseUrl="' + API_BASE + '"',
          '$env:Agent__EnrollmentCode="PASTE-YOUR-CODE-HERE"',
          '$env:Agent__DeviceName="Ops-Laptop"',
          'New-Service -Name CertiWatchAgent -BinaryPathName "C:\\Program Files\\CertiWatch\\certiwatch-agent.exe" -StartupType Automatic',
          "Start-Service CertiWatchAgent"
        ].join("\n")}
      />
    );
  }

  if (os === "linux") {
    return (
      <CodeBlock
        code={`sudo cp apps/agent/bin/Release/net8.0/publish/certiwatch-agent /usr/local/bin/
cat <<'UNIT' | sudo tee /etc/systemd/system/certiwatch-agent.service
[Unit]
Description=CertiWatch Local Agent
After=network.target

[Service]
Environment=Agent__ApiBaseUrl=${API_BASE}
Environment=Agent__EnrollmentCode=PASTE-YOUR-CODE-HERE
Environment=Agent__DeviceName=%H
ExecStart=/usr/local/bin/certiwatch-agent
Restart=always

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl enable --now certiwatch-agent`}
      />
    );
  }

  return (
    <p className="text-sm text-slate-600">
      Package the agent binary with a <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">launchd</code>{" "}
      <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">.plist</code> that runs it at load, setting{" "}
      <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">Agent__ApiBaseUrl</code>,{" "}
      <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">Agent__EnrollmentCode</code>, and{" "}
      <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">Agent__DeviceName</code> under an{" "}
      <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">EnvironmentVariables</code> dict — the same
      variables shown for Windows/Linux.
    </p>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard access can be denied by the browser; the text is still visible to copy manually
    }
  };

  return (
    <div className="relative">
      <button
        onClick={copy}
        className="absolute right-2 top-2 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-700"
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 pr-16 text-xs text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Header({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">{children}</th>;
}

function Cell({ children, mono = false }: { children: React.ReactNode; mono?: boolean }) {
  return <td className={`px-3 py-2 text-slate-800 ${mono ? "font-mono text-xs" : ""}`}>{children}</td>;
}
