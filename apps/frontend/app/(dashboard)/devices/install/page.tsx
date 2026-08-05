"use client";

import Link from "next/link";

const GITHUB_REPO = "bhoyee/CertiWatch";
const RELEASE_BASE = `https://github.com/${GITHUB_REPO}/releases/download/agent-latest`;

const downloads = [
  { label: "Windows", sub: "win-x64", file: "certiwatch-agent-win-x64.zip" },
  { label: "Linux", sub: "linux-x64", file: "certiwatch-agent-linux-x64.tar.gz" },
  { label: "macOS (Apple Silicon)", sub: "osx-arm64", file: "certiwatch-agent-osx-arm64.tar.gz" },
  { label: "macOS (Intel)", sub: "osx-x64", file: "certiwatch-agent-osx-x64.tar.gz" }
];

export default function AgentInstallPage() {
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
        <h2 className="text-md font-semibold text-slate-900">Easiest: one command, nothing to install by hand</h2>
        <p className="mt-1 text-sm text-slate-700">
          From the{" "}
          <Link href="/devices" className="font-medium text-blue-600 hover:underline">
            Devices page
          </Link>
          , click <span className="font-medium">Generate enrollment code</span>. That panel shows a single
          copy-paste command with the code already filled in — it downloads the agent, installs it as a service,
          and starts it, all in one step. Didn't specify a folder? The command opens a native folder picker on
          the machine you run it on, so you never have to type a path by hand.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-md font-semibold text-slate-900">Or download it directly</h2>
        <p className="mt-1 text-sm text-slate-600">
          The same binary the one-line command installs. Prefer this if you'd rather run it yourself, inspect it
          first, or install on a machine without terminal access to paste a command into.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {downloads.map((d) => (
            <a
              key={d.file}
              href={`${RELEASE_BASE}/${d.file}`}
              className="flex items-center justify-between rounded-md border border-slate-200 px-4 py-3 text-sm hover:border-blue-300 hover:bg-blue-50"
            >
              <span>
                <span className="font-semibold text-slate-900">Download for {d.label}</span>
                <span className="ml-2 text-xs text-slate-500">{d.sub}</span>
              </span>
              <span aria-hidden="true" className="text-slate-400">
                &darr;
              </span>
            </a>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Not code-signed yet — Windows/macOS will show an "unknown publisher" warning the first time you run it.
          That's expected for now, not a sign anything's wrong.
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
    </div>
  );
}
