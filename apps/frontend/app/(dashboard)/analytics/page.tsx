"use client";

import { useEffect, useRef, useState } from "react";
import { fetchJson } from "../../../lib/api";
import { useRole } from "../RoleContext";

type DayCount = { date: string; count: number };
type ExpiryBuckets = { next7: number; next30: number; next60: number; next90Plus: number };

type AnalyticsOverviewDto = {
  totalRecords: number;
  expiringSoon: number;
  expired: number;
  lowConfidence: number;
  devices: number;
  sources: number;
  statusCounts: Record<string, number>;
  expiringSoonList: ExpiringRow[];
  recordsTrend: DayCount[];
  expiryBuckets: ExpiryBuckets;
  newThisWeek: number;
  newLastWeek: number;
};

type ReminderPreviewDto = {
  expiringIn7: number;
  expiringIn30: number;
  needsReview: number;
  upcoming: Array<{ id: string; staffName: string; courseName: string; expiryDate: string; issuer?: string | null }>;
};

type ExpiringRow = {
  id: string;
  staffName: string | null;
  courseName: string | null;
  issuer?: string | null;
  issueDate?: string | null;
  expiryDate: string | null;
  expiryDerived?: boolean;
  confidence?: number;
  processingStatus?: string | number;
};

const REFRESH_MS = 20000;

export default function AnalyticsPage() {
  const { role } = useRole();
  const isViewer = role?.toLowerCase() === "viewer";
  const isManager = role?.toLowerCase() === "manager";
  const [data, setData] = useState<AnalyticsOverviewDto | null>(null);
  const [reminders, setReminders] = useState<ReminderPreviewDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [, forceTick] = useState(0);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<"staff" | "course" | "expiry" | "status">("expiry");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const hasLoadedOnce = useRef(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const [ov, rem] = await Promise.all([
          fetchJson<AnalyticsOverviewDto>("/api/reports/analytics"),
          fetchJson<ReminderPreviewDto>("/api/notifications/reminders/preview").catch((err) => {
            throw { __reminder: true, err };
          })
        ]).catch(async (thrown) => {
          // If only the reminder preview failed, still let the main analytics load succeed -
          // this mirrors the original two-independent-fetches behavior instead of letting one
          // slow/broken endpoint blank out the whole page.
          if (thrown?.__reminder) {
            const ov2 = await fetchJson<AnalyticsOverviewDto>("/api/reports/analytics");
            if (active) setReminderError(thrown.err?.message ?? "Failed to load reminders");
            return [ov2, null] as const;
          }
          throw thrown;
        });
        if (!active) return;
        setData(ov);
        if (rem) {
          setReminders(rem);
          setReminderError(null);
        }
        setError(null);
        setLastUpdated(new Date());
      } catch (err: any) {
        // Silent refreshes never clear already-good data out from under the user just because
        // one poll hiccuped - only the very first load surfaces a hard error state.
        if (active && !hasLoadedOnce.current) {
          setError(err?.message ?? "Failed to load analytics");
        }
      } finally {
        hasLoadedOnce.current = true;
      }
    };

    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  // Re-render once a minute purely so the "Updated Xm ago" label stays accurate between polls.
  useEffect(() => {
    const id = setInterval(() => forceTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  if (error && !data) return <ErrorCard message={error} />;
  if (!data) return <LoadingCard />;

  const weekDelta = data.newThisWeek - data.newLastWeek;

  const baseCards: StatCardProps[] = [
    {
      label: "Total records",
      value: data.totalRecords,
      icon: "records",
      accent: "bg-indigo-600",
      delta: weekDelta,
      sparkline: data.recordsTrend
    },
    { label: "Expiring soon", value: data.expiringSoon, icon: "clock", accent: "bg-amber-500" },
    { label: "Expired", value: data.expired, icon: "alert", accent: "bg-rose-600" },
    { label: "Low confidence", value: data.lowConfidence, icon: "flag", accent: "bg-slate-500" },
    { label: "Devices", value: data.devices, icon: "device", accent: "bg-emerald-600" },
    { label: "Sources", value: data.sources, icon: "plug", accent: "bg-cyan-600" }
  ];
  const cards = isViewer || isManager ? baseCards.filter((c) => c.label !== "Devices" && c.label !== "Sources") : baseCards;

  const statusEntries = Object.entries(data.statusCounts ?? {});
  const expiringList: ExpiringRow[] =
    reminders?.upcoming?.map((row) => ({
      id: row.id,
      staffName: row.staffName ?? null,
      courseName: row.courseName ?? null,
      issuer: row.issuer ?? null,
      expiryDate: row.expiryDate ?? null
    })) ??
    data.expiringSoonList ??
    [];

  const filteredSoon = expiringList.filter((r) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    const staff = (r.staffName ?? "").toLowerCase();
    const course = (r.courseName ?? "").toLowerCase();
    const issuer = (r.issuer ?? "").toLowerCase();
    return staff.includes(term) || course.includes(term) || issuer.includes(term);
  });

  const sortedSoon = [...filteredSoon].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortKey) {
      case "staff":
        return (a.staffName ?? "").localeCompare(b.staffName ?? "") * dir;
      case "course":
        return (a.courseName ?? "").localeCompare(b.courseName ?? "") * dir;
      case "expiry":
      default: {
        const aDate = a.expiryDate ?? "";
        const bDate = b.expiryDate ?? "";
        return aDate.localeCompare(bDate) * dir;
      }
    }
  });

  const totalPages = Math.max(1, Math.ceil(sortedSoon.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const visibleSoon = sortedSoon.slice(start, start + pageSize);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-slate-900">Analytics</h1>
        <LiveIndicator lastUpdated={lastUpdated} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        {cards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <ChartCard title="Records over time" subtitle="Successfully processed, last 30 days" className="lg:col-span-3">
          <TrendAreaChart data={data.recordsTrend} />
        </ChartCard>
        <ChartCard title="Upcoming expiries" subtitle="Records not yet expired" className="lg:col-span-2">
          <ExpiryBarChart buckets={data.expiryBuckets} />
        </ChartCard>
      </div>

      {statusEntries.length > 0 && (
        <ChartCard title="Processing status" subtitle="Where every record stands right now">
          <StatusDonut entries={statusEntries} />
        </ChartCard>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-slate-600">Expiring soon (next 30 days)</p>
            <p className="text-lg font-semibold text-slate-900">{data.expiringSoon} records</p>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:justify-end">
            {reminderError && <p className="text-xs text-rose-600">Reminder preview unavailable</p>}
            {reminders && (
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge color="bg-amber-100 text-amber-800">30 days: {reminders.expiringIn30}</Badge>
                <Badge color="bg-rose-100 text-rose-700">7 days: {reminders.expiringIn7}</Badge>
                <Badge color="bg-indigo-100 text-indigo-700">Needs review: {reminders.needsReview}</Badge>
              </div>
            )}
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search staff, requirement, issuer..."
              className="w-full rounded-md border-2 border-slate-300 px-3 py-2 text-sm shadow-inner transition focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100 md:w-64"
            />
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              {[10, 25, 50].map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="-mx-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <Header onClick={() => toggleSort("staff")} sorted={sortKey === "staff"} dir={sortDir}>
                  Staff name
                </Header>
                <Header onClick={() => toggleSort("course")} sorted={sortKey === "course"} dir={sortDir}>
                  Requirement type
                </Header>
                <Header onClick={() => toggleSort("expiry")} sorted={sortKey === "expiry"} dir={sortDir}>
                  Expiry
                </Header>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {visibleSoon.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <Cell>{r.staffName ?? "--"}</Cell>
                  <Cell>{r.courseName ?? "--"}</Cell>
                  <Cell>{r.expiryDate ?? "--"}</Cell>
                </tr>
              ))}
              {visibleSoon.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-center text-sm text-slate-500">
                    No records match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-col gap-2 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
          <span>
            Showing {sortedSoon.length === 0 ? 0 : start + 1}-{Math.min(sortedSoon.length, start + pageSize)} of {sortedSoon.length} records
          </span>
          <div className="flex items-center gap-2">
            <button
              className="rounded-md border border-slate-200 px-3 py-1 text-sm font-medium text-slate-700 disabled:opacity-50"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            <span className="text-slate-700">
              Page {currentPage} / {totalPages}
            </span>
            <button
              className="rounded-md border border-slate-200 px-3 py-1 text-sm font-medium text-slate-700 disabled:opacity-50"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LiveIndicator({ lastUpdated }: { lastUpdated: Date | null }) {
  if (!lastUpdated) return null;
  const secondsAgo = Math.max(0, Math.round((Date.now() - lastUpdated.getTime()) / 1000));
  const label = secondsAgo < 60 ? `${secondsAgo}s ago` : `${Math.round(secondsAgo / 60)}m ago`;
  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-500">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      Live · updated {label}
    </div>
  );
}

type StatCardProps = {
  label: string;
  value: number;
  icon: "records" | "clock" | "alert" | "flag" | "device" | "plug";
  accent: string;
  delta?: number;
  sparkline?: DayCount[];
};

const ACCENT_TINTS: Record<string, string> = {
  "bg-indigo-600": "border-indigo-100 bg-indigo-50/70",
  "bg-amber-500": "border-amber-100 bg-amber-50/70",
  "bg-rose-600": "border-rose-100 bg-rose-50/70",
  "bg-slate-500": "border-slate-200 bg-slate-100/70",
  "bg-emerald-600": "border-emerald-100 bg-emerald-50/70",
  "bg-cyan-600": "border-cyan-100 bg-cyan-50/70"
};

const ACCENT_LINES: Record<string, string> = {
  "bg-indigo-600": "bg-indigo-400",
  "bg-amber-500": "bg-amber-400",
  "bg-rose-600": "bg-rose-400",
  "bg-slate-500": "bg-slate-400",
  "bg-emerald-600": "bg-emerald-400",
  "bg-cyan-600": "bg-cyan-400"
};

function StatCard({ label, value, icon, accent, delta, sparkline }: StatCardProps) {
  const tint = ACCENT_TINTS[accent] ?? "border-slate-200 bg-white";
  const hasSparkline = sparkline && sparkline.length > 1;
  return (
    <div className={`rounded-xl border p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${tint}`}>
      <div className="flex items-start justify-between">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-white shadow-sm ${accent}`}>
          <StatIcon name={icon} />
        </div>
        {typeof delta === "number" && (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
              delta > 0 ? "bg-emerald-50 text-emerald-700" : delta < 0 ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"
            }`}
          >
            {delta > 0 ? "+" : ""}
            {delta} this wk
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-extrabold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
      <div className="mt-2 flex h-5 items-center">
        {hasSparkline ? (
          <Sparkline data={sparkline!} />
        ) : (
          <div className={`h-0.5 w-full rounded-full ${ACCENT_LINES[accent] ?? "bg-slate-300"}`} />
        )}
      </div>
    </div>
  );
}

function Sparkline({ data }: { data: DayCount[] }) {
  const width = 200;
  const height = 32;
  const max = Math.max(1, ...data.map((d) => d.count));
  const stepX = data.length > 1 ? width / (data.length - 1) : width;
  const points = data.map((d, i) => ({ x: i * stepX, y: height - (d.count / max) * (height - 4) - 2 }));
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" preserveAspectRatio="none">
      <path d={linePath} fill="none" stroke="#6366f1" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
    </svg>
  );
}

function StatIcon({ name }: { name: StatCardProps["icon"] }) {
  const cls = "h-4 w-4";
  switch (name) {
    case "records":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M8 9h8M8 13h8M8 17h5" strokeLinecap="round" />
        </svg>
      );
    case "clock":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3.5 2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "alert":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 3 2 20h20L12 3Z" strokeLinejoin="round" />
          <path d="M12 10v4M12 17h.01" strokeLinecap="round" />
        </svg>
      );
    case "flag":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M5 4v16M5 4h10l-2 4 4 4H5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "device":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="7" y="7" width="10" height="10" rx="2" />
          <path d="M4 10v4M20 10v4M10 4h4M10 20h4" strokeLinecap="round" />
        </svg>
      );
    case "plug":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M7 2v5m10-5v5M6 9h12l-1 6a5 5 0 0 1-5 4 5 5 0 0 1-5-4L6 9Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

function ChartCard({
  title,
  subtitle,
  children,
  className = ""
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      {/* flex-1 (no justify-end): when this card sits next to a taller sibling in the same grid
          row (grid stretches both to equal height), this hands the chart the full stretched
          height instead of leaving it below a compact block - each chart fills it how it needs
          to (ExpiryBarChart keeps values pinned top and labels pinned bottom via its own
          internal flex layout, rather than the whole block just sliding down as one unit). */}
      <div className="mt-4 flex-1">{children}</div>
    </div>
  );
}

function TrendAreaChart({ data }: { data: DayCount[] }) {
  const width = 600;
  const height = 130;
  if (data.length === 0) return <p className="text-sm text-slate-500">No data yet.</p>;
  const max = Math.max(1, ...data.map((d) => d.count));
  const stepX = data.length > 1 ? width / (data.length - 1) : width;
  const points = data.map((d, i) => ({ x: i * stepX, y: height - (d.count / max) * (height - 16) - 8 }));
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height} L 0 ${height} Z`;
  const last = points[points.length - 1];
  const total = data.reduce((a, d) => a + d.count, 0);

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="analyticsTrendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={width} y1={height * f} y2={height * f} stroke="#f1f5f9" strokeWidth="1" />
        ))}
        <path d={areaPath} fill="url(#analyticsTrendFill)" />
        <path d={linePath} fill="none" stroke="#6366f1" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={last.x} cy={last.y} r="3.5" fill="#6366f1" stroke="white" strokeWidth="1.5" />
      </svg>
      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
        <span>{formatShortDate(data[0].date)}</span>
        <span className="font-medium text-slate-500">{total} total</span>
        <span>{formatShortDate(data[data.length - 1].date)}</span>
      </div>
    </div>
  );
}

function formatShortDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const STATUS_COLORS: Record<string, string> = {
  ok: "#10b981",
  needsreview: "#f43f5e",
  pending: "#f59e0b",
  failed: "#64748b"
};

function colorForStatus(status: string) {
  return STATUS_COLORS[status.toLowerCase().replace(/\s+/g, "")] ?? "#6366f1";
}

function StatusDonut({ entries }: { entries: Array<[string, number]> }) {
  const total = entries.reduce((acc, [, v]) => acc + v, 0);
  if (total === 0) return <p className="text-sm text-slate-500">No data yet.</p>;

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  let offsetAcc = 0;

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      {/* The center label is a plain HTML overlay, not SVG <text>: the donut itself needs
          -rotate-90 so segments start at 12 o'clock, and rotating text along with it (then
          counter-rotating just the text) is exactly the kind of thing that silently renders
          sideways in some browsers - easier to keep it out of the rotated coordinate space. */}
      <div className="relative h-36 w-36 flex-shrink-0">
        <svg viewBox="0 0 100 100" className="h-36 w-36 -rotate-90">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="14" />
          {entries.map(([status, count]) => {
            const pct = count / total;
            const dash = pct * circumference;
            const segment = (
              <circle
                key={status}
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={colorForStatus(status)}
                strokeWidth="14"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offsetAcc}
              />
            );
            offsetAcc += dash;
            return segment;
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-slate-900">{total}</span>
          <span className="text-[10px] text-slate-400">records</span>
        </div>
      </div>
      <div className="grid w-full grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        {entries.map(([status, count]) => (
          <div key={status} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: colorForStatus(status) }} />
            <span className="truncate capitalize text-slate-700">{status.toLowerCase()}</span>
            <span className="ml-auto font-semibold text-slate-900">{count}</span>
            <span className="w-10 text-right text-xs text-slate-400">{Math.round((count / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExpiryBarChart({ buckets }: { buckets: ExpiryBuckets }) {
  const items = [
    { label: "0-7 days", value: buckets.next7, color: "bg-rose-500" },
    { label: "8-30 days", value: buckets.next30, color: "bg-amber-500" },
    { label: "31-60 days", value: buckets.next60, color: "bg-blue-500" },
    { label: "60+ days", value: buckets.next90Plus, color: "bg-emerald-500" }
  ];
  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <div className="flex h-full min-h-[140px] items-stretch justify-between gap-2">
      {items.map((item) => (
        <div key={item.label} className="flex flex-1 flex-col items-center gap-2">
          <span className="text-sm font-semibold text-slate-900">{item.value}</span>
          {/* A flex-grow "bar chart without measuring" trick: the spacer above and the bar below
              share the track's height in proportion to (max - value) : value, so the bar's
              rendered height always reflects its share of the tallest bucket, and it naturally
              sits at the bottom of the track (last child in a column flex) - values stay pinned
              to the top of the card and labels to the bottom regardless of the track's actual
              pixel height, which changes whenever this card is stretched to match a taller sibling. */}
          <div className="flex w-full flex-1 flex-col items-center">
            <div style={{ flex: `${Math.max(0, max - item.value)} 1 0%` }} />
            <div
              className={`w-7 rounded-t-md transition-all duration-500 sm:w-9 ${item.color}`}
              style={{ flex: `${item.value === 0 ? 0 : item.value} 1 0%`, minHeight: item.value === 0 ? 4 : 6 }}
            />
          </div>
          <span className="text-center text-[11px] leading-tight text-slate-500">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function Header({
  children,
  onClick,
  sorted,
  dir
}: {
  children: React.ReactNode;
  onClick?: () => void;
  sorted?: boolean;
  dir?: "asc" | "desc";
}) {
  return (
    <th
      className={`px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 ${
        onClick ? "cursor-pointer select-none" : ""
      }`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      <div className="flex items-center gap-1">
        <span>{children}</span>
        {sorted && <span className="text-slate-400">{dir === "asc" ? "^" : "v"}</span>}
      </div>
    </th>
  );
}

function Cell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 text-slate-800 ${className}`}>{children}</td>;
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-1 font-semibold ${color}`}>{children}</span>;
}

function LoadingCard() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">Loading analytics...</div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
      Failed to load analytics: {message}
    </div>
  );
}
