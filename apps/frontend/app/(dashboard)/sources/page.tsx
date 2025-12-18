"use client";

import { useEffect, useState } from "react";
import { fetchJson, postJson } from "../../../lib/api";

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

type Provider = "s3" | "gcs" | "azure" | "dropbox" | "webdav" | "httpdir";

type FormState = {
  displayName: string;
  provider: Provider;
  bucket: string;
  prefix: string;
  region: string;
  endpoint: string;
  accessKey: string;
  secretKey: string;
  serviceAccount: string;
  container: string;
  connectionString: string;
  accountName: string;
  accountKey: string;
  path: string;
  accessToken: string;
  baseUrl: string;
  username: string;
  password: string;
};

const providerOptions: { value: Provider; label: string }[] = [
  { value: "s3", label: "S3 / MinIO" },
  { value: "gcs", label: "Google Cloud Storage" },
  { value: "azure", label: "Azure Blob" },
  { value: "dropbox", label: "Dropbox" },
  { value: "webdav", label: "WebDAV" },
  { value: "httpdir", label: "HTTP directory" }
];

const emptyForm: FormState = {
  displayName: "",
  provider: "s3",
  bucket: "",
  prefix: "",
  region: "",
  endpoint: "",
  accessKey: "",
  secretKey: "",
  serviceAccount: "",
  container: "",
  connectionString: "",
  accountName: "",
  accountKey: "",
  path: "",
  accessToken: "",
  baseUrl: "",
  username: "",
  password: ""
};

export default function SourcesPage() {
  const [sources, setSources] = useState<SourceDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState<FormState>(emptyForm);

  const load = () => {
    fetchJson<SourceDto[]>("/api/sources")
      .then(setSources)
      .catch((err) => setError(err.message ?? "Failed to load sources"));
  };

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

  useEffect(() => {
    load();
  }, []);

  if (error) return <ErrorCard message={error} />;
  if (!sources) return <LoadingCard />;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4">
          <h1 className="text-lg font-semibold text-slate-900">Sources</h1>
          <p className="text-sm text-slate-600">Configured ingestion sources.</p>
        </div>

        <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h2 className="text-md font-semibold text-slate-900">Add cloud source</h2>
          <p className="text-sm text-slate-600">
            Connect cloud storage (S3/GCS/Azure/Dropbox/WebDAV/HTTP). Credentials are tenant-scoped and masked in the list.
          </p>
          <form
            className="mt-3 grid gap-3 md:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              setCreating(true);
              setError(null);
              try {
                const config = buildConfig(form);
                await postJson("/api/sources", {
                  type: "CloudImport",
                  displayName:
                    form.displayName ||
                    {
                      s3: `S3 ${form.bucket}`,
                      gcs: `GCS ${form.bucket}`,
                      azure: `Azure ${form.container}`,
                      dropbox: "Dropbox import",
                      webdav: `WebDAV ${form.baseUrl}`,
                      httpdir: `HTTP ${form.baseUrl}`
                    }[form.provider],
                  config
                });
                load();
                setForm({ ...emptyForm, provider: form.provider });
              } catch (err: any) {
                setError(err.message ?? "Failed to add source");
              } finally {
                setCreating(false);
              }
            }}
          >
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium text-slate-700">Display name</label>
              <input
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="My cloud source"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Provider</label>
              <select
                value={form.provider}
                onChange={(e) => setForm({ ...form, provider: e.target.value as Provider })}
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                {providerOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {renderProviderFields(form, setForm)}
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={creating}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
              >
                {creating ? "Saving..." : "Add source"}
              </button>
              {error && <span className="ml-3 text-sm text-rose-700">{error}</span>}
            </div>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <Header>Name</Header>
                <Header>Type</Header>
                <Header>Status</Header>
                <Header>Last sync</Header>
                <Header>Error</Header>
                <Header>Created</Header>
                <Header>Config</Header>
                <Header>Actions</Header>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sources.map((s) => {
                const syncStatus = getSyncStatus(s);
                const lastSync = getSyncDate(s);
                const syncError = getSyncError(s);
                const isCloudImport = isCloudImportSource(s);
                return (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <Cell>{s.displayName}</Cell>
                    <Cell className="capitalize">{formatSourceType(s.type)}</Cell>
                    <Cell>
                      <StatusPill value={syncStatus} />
                    </Cell>
                    <Cell>{formatDate(lastSync)}</Cell>
                    <Cell className="text-xs text-rose-600">{syncError || "--"}</Cell>
                    <Cell>{new Date(s.createdAt).toLocaleDateString()}</Cell>
                    <Cell>
                      {s.config && Object.keys(s.config).length > 0 ? (
                        <div className="text-xs text-slate-700">
                          {Object.entries(s.config).map(([k, v]) => (
                            <div key={k}>
                              <span className="font-medium">{k}:</span> {v}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-500">--</span>
                      )}
                    </Cell>
                    <Cell>
                      {isCloudImport ? (
                        <button
                          onClick={() => syncNow(s.id)}
                          disabled={syncing[s.id]}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          {syncing[s.id] ? "Syncing..." : "Sync now"}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500">--</span>
                      )}
                    </Cell>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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

function Field({
  label,
  value,
  onChange,
  required,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-slate-700">
        {label}
        {required ? <span className="text-rose-600"> *</span> : null}
      </label>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
      />
    </div>
  );
}

function buildConfig(form: FormState): Record<string, string> {
  const cfg: Record<string, string> = { provider: form.provider };
  switch (form.provider) {
    case "s3":
      assignIf(cfg, "bucket", form.bucket);
      assignIf(cfg, "prefix", form.prefix);
      assignIf(cfg, "region", form.region);
      assignIf(cfg, "endpoint", form.endpoint);
      assignIf(cfg, "accessKey", form.accessKey);
      assignIf(cfg, "secretKey", form.secretKey);
      break;
    case "gcs":
      assignIf(cfg, "bucket", form.bucket);
      assignIf(cfg, "prefix", form.prefix);
      assignIf(cfg, "serviceAccount", form.serviceAccount);
      break;
    case "azure":
      assignIf(cfg, "container", form.container);
      assignIf(cfg, "prefix", form.prefix);
      assignIf(cfg, "connectionString", form.connectionString);
      assignIf(cfg, "accountName", form.accountName);
      assignIf(cfg, "accountKey", form.accountKey);
      break;
    case "dropbox":
      assignIf(cfg, "path", form.path);
      assignIf(cfg, "accessToken", form.accessToken);
      break;
    case "webdav":
    case "httpdir":
      assignIf(cfg, "baseUrl", form.baseUrl);
      assignIf(cfg, "path", form.path);
      assignIf(cfg, "username", form.username);
      assignIf(cfg, "password", form.password);
      break;
    default:
      break;
  }
  return cfg;
}

function renderProviderFields(form: FormState, setForm: (f: FormState) => void) {
  switch (form.provider) {
    case "s3":
      return (
        <>
          <Field label="Bucket" value={form.bucket} onChange={(v) => setForm({ ...form, bucket: v })} required />
          <Field label="Prefix (optional)" value={form.prefix} onChange={(v) => setForm({ ...form, prefix: v })} />
          <Field label="Region" value={form.region} onChange={(v) => setForm({ ...form, region: v })} />
          <Field label="Endpoint (optional, for MinIO)" value={form.endpoint} onChange={(v) => setForm({ ...form, endpoint: v })} />
          <Field label="Access key" value={form.accessKey} onChange={(v) => setForm({ ...form, accessKey: v })} required />
          <Field label="Secret key" value={form.secretKey} onChange={(v) => setForm({ ...form, secretKey: v })} required type="password" />
        </>
      );
    case "gcs":
      return (
        <>
          <Field label="Bucket" value={form.bucket} onChange={(v) => setForm({ ...form, bucket: v })} required />
          <Field label="Prefix (optional)" value={form.prefix} onChange={(v) => setForm({ ...form, prefix: v })} />
          <Field label="Service account JSON" value={form.serviceAccount} onChange={(v) => setForm({ ...form, serviceAccount: v })} required />
        </>
      );
    case "azure":
      return (
        <>
          <Field label="Container" value={form.container} onChange={(v) => setForm({ ...form, container: v })} required />
          <Field label="Prefix (optional)" value={form.prefix} onChange={(v) => setForm({ ...form, prefix: v })} />
          <Field
            label="Connection string"
            value={form.connectionString}
            onChange={(v) => setForm({ ...form, connectionString: v })}
            required={!form.accountName || !form.accountKey}
          />
          <Field label="Account name" value={form.accountName} onChange={(v) => setForm({ ...form, accountName: v })} />
          <Field label="Account key" value={form.accountKey} onChange={(v) => setForm({ ...form, accountKey: v })} type="password" />
        </>
      );
    case "dropbox":
      return (
        <>
          <Field label="Folder path" value={form.path} onChange={(v) => setForm({ ...form, path: v })} />
          <Field label="Access token" value={form.accessToken} onChange={(v) => setForm({ ...form, accessToken: v })} required type="password" />
        </>
      );
    case "webdav":
    case "httpdir":
      return (
        <>
          <Field label="Base URL" value={form.baseUrl} onChange={(v) => setForm({ ...form, baseUrl: v })} required />
          <Field label="Path/Prefix" value={form.path} onChange={(v) => setForm({ ...form, path: v })} />
          <Field label="Username" value={form.username} onChange={(v) => setForm({ ...form, username: v })} />
          <Field label="Password / token" value={form.password} onChange={(v) => setForm({ ...form, password: v })} type="password" />
        </>
      );
    default:
      return null;
  }
}

function assignIf(target: Record<string, string>, key: string, value: string) {
  if (value) target[key] = value;
}

function isCloudImportSource(source: SourceDto) {
  const typeValue = String(source.type ?? "").toLowerCase();
  return typeValue === "cloudimport" || typeValue === "4";
}

function formatSourceType(value: string | number) {
  const raw = String(value ?? "");
  return raw ? raw.toLowerCase() : "--";
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
