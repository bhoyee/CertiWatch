export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Silent Auditor</p>
        <h1 className="text-2xl font-semibold">CertiWatch Admin</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "New Records", value: "8" },
          { label: "Expiring Soon", value: "14" },
          { label: "Low Confidence", value: "3" }
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">{stat.label}</p>
            <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
