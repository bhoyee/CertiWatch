import { fetchJson } from "../../../lib/api";

type Source = {
  id: string;
  displayName: string;
  type: string;
};

async function loadSources(): Promise<Source[]> {
  try {
    return await fetchJson<Source[]>("/api/sources");
  } catch {
    return [];
  }
}

export default async function SourcesPage() {
  const sources = await loadSources();
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Sources</p>
        <h1 className="text-2xl font-semibold">Connected Folders</h1>
      </div>
      <div className="space-y-2">
        {sources.map((source) => (
          <div key={source.id} className="rounded-lg border bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">{source.displayName}</p>
            <p className="text-xs uppercase text-slate-500">{source.type}</p>
          </div>
        ))}
        {!sources.length && <p className="text-sm text-slate-500">No sources configured.</p>}
      </div>
    </div>
  );
}
