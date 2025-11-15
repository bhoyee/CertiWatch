import { RecordDto } from "../types";

interface Props {
  records: RecordDto[];
}

export function RecordTable({ records }: Props) {
  return (
    <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            {["Staff", "Course", "Expiry", "Confidence"].map((header) => (
              <th
                key={header}
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {records.map((record) => (
            <tr key={record.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 text-sm font-medium text-slate-900">{record.staffName}</td>
              <td className="px-4 py-3 text-sm text-slate-600">{record.courseName}</td>
              <td className="px-4 py-3 text-sm text-slate-600">{record.expiryDate ?? "TBC"}</td>
              <td className="px-4 py-3 text-sm">
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold uppercase text-slate-600">
                  {record.confidenceBand}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
