export const dynamic = "force-dynamic";

import { RecordTable } from "../../../components/RecordTable";
import { fetchJson } from "../../../lib/api";
import { RecordDto } from "../../../types";

async function loadRecords(): Promise<RecordDto[]> {
  try {
    const response = await fetchJson<{ items: RecordDto[] }>("/api/records");
    return response.items;
  } catch (error) {
    console.error(error);
    return [];
  }
}

export default async function RecordsPage() {
  const records = await loadRecords();
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Records</p>
        <h1 className="text-2xl font-semibold">Compliance Records</h1>
      </div>
      <RecordTable records={records} />
    </div>
  );
}
