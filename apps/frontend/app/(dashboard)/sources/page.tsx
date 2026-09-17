"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchJson, patchJson, deleteJson, postJson, apiUrl } from "../../../lib/api";

type SourceDto = {
  id: string;
  type: string | number;
  displayName: string;
  config: Record<string, string>;
  createdAt: string;
  lastSync?: string | null;
  syncStatus?: string | null;
  syncError?: string | null;
};

const ERROR_MESSAGES: Record<string, string> = {
  state_mismatch: "That connection attempt looks like it expired or was tampered with - please try connecting again.",
  token_exchange_failed: "Google/Microsoft didn't accept the connection - please try again.",
  no_refresh_token: "We didn't receive lasting access from that connection - please try again and make sure to approve access when prompted.",
  access_denied: "The connection was cancelled before it finished."
};

export default function SourcesPage() {
  return (
    <Suspense fallback={<LoadingCard />}>
      <SourcesPageInner />
    </Suspense>
  );
}

function SourcesPageInner() {
  const searchParams = useSearchParams();
  const [sources, setSources] = useState<SourceDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [folderDrafts, setFolderDrafts] = useState<Record<string, string>>({});
  const [savingFolder, setSavingFolder] = useState<Record<string, boolean>>({});
  const [confirmDisconnect, setConfirmDisconnect] = useState<SourceDto | null>(null);

  const load = () => {
    fetchJson<SourceDto[]>("/api/sources")
      .then(setSources)
      .catch((err) => setError(err.message ?? "Failed to load sources"));
  };

  useEffect(() => {
    load();
  }, []);

  // Google/Microsoft redirect back here with ?connected=... or ?error=... once the OAuth flow
  // finishes server-side - there's no client-side callback to handle, just this banner.
  useEffect(() => {
    const connected = searchParams?.get("connected");
    const oauthError = searchParams?.get("error");
    if (connected) {
      const label = connected === "google" ? "Google Drive" : connected === "microsoft" ? "Microsoft OneDrive" : connected;
      setBanner({ tone: "success", text: `Connected to ${label}. Choose a folder below to start syncing.` });
      window.history.replaceState(null, "", "/sources");
    } else if (oauthError) {
      setBanner({ tone: "error", text: ERROR_MESSAGES[oauthError] ?? `Couldn't connect: ${oauthError}` });
      window.history.replaceState(null, "", "/sources");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncNow = async (id: string) => {
    setSyncing((s) => ({ ...s, [id]: true }));
    try {
      await postJson(`/api/sources/${id}/sync-now`, {});
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Failed to trigger sync");
    } finally {
      setSyncing((s) => ({ ...s, [id]: false }));
    }
  };

  const confirmDisconnectNow = async () => {
    if (!confirmDisconnect) return;
    const id = confirmDisconnect.id;
    setDeleting((s) => ({ ...s, [id]: true }));
    try {
      await deleteJson(`/api/sources/${id}`);
      await load();
      setConfirmDisconnect(null);
    } catch (err: any) {
      setError(err?.message ?? "Failed to disconnect source");
    } finally {
      setDeleting((s) => ({ ...s, [id]: false }));
    }
  };

  const saveFolder = async (id: string) => {
    const folderId = (folderDrafts[id] ?? "").trim();
    if (!folderId) return;
    setSavingFolder((s) => ({ ...s, [id]: true }));
    try {
      await patchJson(`/api/sources/${id}`, { folderId });
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Failed to save folder");
    } finally {
      setSavingFolder((s) => ({ ...s, [id]: false }));
    }
  };

  if (error) return <ErrorCard message={error} />;
  if (!sources) return <LoadingCard />;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4">
          <h1 className="text-lg font-semibold text-slate-900">Sources</h1>
          <p className="text-sm text-slate-600">
            Connect a cloud folder and CertiWatch will pull in new certificates the same way it does from an uploaded
            device - no secret keys, just a normal sign-in.
          </p>
        </div>

        {banner && (
          <div
            className={`mb-4 flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm ${
              banner.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            <span>{banner.text}</span>
            <button onClick={() => setBanner(null)} className="flex-shrink-0 text-xs font-semibold underline">
              Dismiss
            </button>
          </div>
        )}

        <div className="mb-6 flex flex-wrap gap-3">
          <a
            href={apiUrl("/api/sources/oauth/google/start")}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
          >
            <span aria-hidden="true">📁</span> Connect Google Drive
          </a>
          <a
            href={apiUrl("/api/sources/oauth/microsoft/start")}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
          >
            <span aria-hidden="true">☁️</span> Connect Microsoft OneDrive
          </a>
        </div>

        {sources.length === 0 ? (
          <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
            No cloud sources connected yet. Connect Google Drive or OneDrive above, or just keep uploading documents
            directly - that always works too.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <Header>Name</Header>
                  <Header>Folder</Header>
                  <Header>Status</Header>
                  <Header>Last sync</Header>
                  <Header>Connected</Header>
                  <Header>Actions</Header>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sources.map((s) => {
                  const provider = s.config?.provider ?? "";
                  const folderId = s.config?.folderId ?? "";
                  const folderLabel = s.config?.folderLabel;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <Cell>
                        <div className="font-medium text-slate-900">{s.displayName}</div>
                        <div className="text-xs text-slate-500">{providerLabel(provider)}</div>
                      </Cell>
                      <Cell>
                        {folderId ? (
                          <span className="text-slate-700">{folderLabel || folderId}</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <input
                              value={folderDrafts[s.id] ?? ""}
                              onChange={(e) => setFolderDrafts((d) => ({ ...d, [s.id]: e.target.value }))}
                              placeholder={provider === "onedrive" ? "OneDrive folder ID" : "Google Drive folder ID"}
                              className="w-40 rounded-md border border-slate-200 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                            />
                            <button
                              onClick={() => saveFolder(s.id)}
                              disabled={savingFolder[s.id] || !(folderDrafts[s.id] ?? "").trim()}
                              className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                              {savingFolder[s.id] ? "Saving..." : "Save"}
                            </button>
                          </div>
                        )}
                      </Cell>
                      <Cell>
                        <StatusPill value={getSyncStatus(s)} />
                      </Cell>
                      <Cell>{formatDate(getSyncDate(s))}</Cell>
                      <Cell>{new Date(s.createdAt).toLocaleDateString()}</Cell>
                      <Cell>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => syncNow(s.id)}
                            disabled={syncing[s.id] || !folderId}
                            title={folderId ? undefined : "Choose a folder first"}
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            {syncing[s.id] ? "Syncing..." : "Sync now"}
                          </button>
                          <button
                            onClick={() => setConfirmDisconnect(s)}
                            disabled={deleting[s.id]}
                            className="rounded-md border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                          >
                            {deleting[s.id] ? "..." : "Disconnect"}
                          </button>
                        </div>
                      </Cell>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {getErrorRow(sources)}

        <div className="mt-6 rounded-md border border-slate-100 bg-slate-50 p-3 text-xs text-slate-500">
          <p className="font-semibold text-slate-600">Where do I find a folder ID?</p>
          <p className="mt-1">
            Google Drive: open the folder in your browser - the ID is the last part of the address, after{" "}
            <code>folders/</code>.
          </p>
          <p className="mt-1">
            OneDrive: open the folder, click Details, and copy the ID shown there (or use the &ldquo;Embed&rdquo;
            link, which contains it).
          </p>
        </div>
      </div>

      {confirmDisconnect && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => setConfirmDisconnect(null)}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-slate-900">Disconnect {confirmDisconnect.displayName}?</h3>
            <p className="mt-2 text-sm text-slate-600">
              Files already imported stay put, but nothing new will be pulled in from this folder until you connect
              it again.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setConfirmDisconnect(null)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDisconnectNow}
                disabled={deleting[confirmDisconnect.id]}
                className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {deleting[confirmDisconnect.id] ? "Disconnecting..." : "Disconnect"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getErrorRow(sources: SourceDto[]) {
  const withErrors = sources.filter((s) => getSyncError(s));
  if (withErrors.length === 0) return null;
  return (
    <div className="mt-4 space-y-1">
      {withErrors.map((s) => (
        <p key={s.id} className="text-xs text-rose-600">
          <span className="font-semibold">{s.displayName}:</span> {getSyncError(s)}
        </p>
      ))}
    </div>
  );
}

function providerLabel(provider: string) {
  switch (provider) {
    case "gdrive":
      return "Google Drive";
    case "onedrive":
      return "Microsoft OneDrive";
    default:
      return provider || "Cloud source";
  }
}

function Header({ children }: { children: React.ReactNode }) {
  return (
    <th className="border-b-2 border-slate-300 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
      {children}
    </th>
  );
}

function Cell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 text-slate-800 ${className}`}>{children}</td>;
}

function StatusPill({ value }: { value: string }) {
  const normalized = (value || "").toLowerCase();
  const styles =
    normalized === "ok" || normalized === "success"
      ? "bg-emerald-100 text-emerald-700"
      : normalized === "queued"
        ? "bg-amber-100 text-amber-700"
        : normalized === "error" || normalized === "failed"
          ? "bg-rose-100 text-rose-700"
          : "bg-slate-100 text-slate-700";
  return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${styles}`}>{value || "--"}</span>;
}

function LoadingCard() {
  return <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">Loading sources...</div>;
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
      Failed to load sources: {message}
    </div>
  );
}

function getSyncStatus(source: SourceDto) {
  return source.syncStatus ?? source.config?.sync_status ?? "--";
}

function getSyncDate(source: SourceDto) {
  return source.lastSync ?? source.config?.last_sync ?? "";
}

function getSyncError(source: SourceDto) {
  return source.syncError ?? source.config?.sync_error ?? "";
}

function formatDate(value: string) {
  if (!value) return "--";
  const dt = new Date(value);
  return isNaN(dt.getTime()) ? "--" : dt.toLocaleString();
}
