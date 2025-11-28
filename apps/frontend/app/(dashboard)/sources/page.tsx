"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "../../lib/api";

type SourceDto = {
  id: string;
  type: string;
  displayName: string;
  config: Record<string, string>;
  createdAt: string;
};

export default function SourcesPage() {
  const [sources, setSources] = useState<SourceDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<SourceDto[]>("/api/sources")
      .then(setSources)
      .catch((err) => setError(err.message ?? "Failed to load sources"));
  }, []);

  if (error) return <ErrorCard message={error} />;
  if (!sources) return <LoadingCard />;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-slate-900">Sources</h1>
        <p className="text-sm text-slate-600">Configured ingestion sources.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <Header>Name</Header>
              <Header>Type</Header>
              <Header>Created</Header>
              <Header>Config</Header>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {sources.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <Cell>{s.displayName}</Cell>
                <Cell className="capitalize">{s.type.toLowerCase()}</Cell>
                <Cell>{new Date(s.createdAt).toLocaleDateString()}</Cell>
                <Cell>
                  {Object.keys(s.config).length === 0 ? (
                    <span className="text-slate-500">—</span>
                  ) : (
                    <div className="text-xs text-slate-700">
                      {Object.entries(s.config).map(([k, v]) => (
                        <div key={k}>
                          <span className="font-medium">{k}:</span> {v}
                        </div>
                      ))}
                    </div>
                  )}
                </Cell>
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
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">Loading sources…</div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
      Failed to load sources: {message}
    </div>
  );
}
