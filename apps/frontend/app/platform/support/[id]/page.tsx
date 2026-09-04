"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchJson, postVoid } from "@/lib/api";

type Message = {
  id: string;
  authorUserId?: string | null;
  authorName?: string | null;
  authorIsPlatform: boolean;
  body: string;
  createdAt: string;
};

type TicketDetail = {
  id: string;
  tenantId: string;
  tenantName: string;
  subject: string;
  body: string;
  status: string;
  assignedRole: string;
  assignedToUserId?: string | null;
  assignedToName?: string | null;
  createdByName?: string | null;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
};

const statusStyles: Record<string, string> = {
  open: "bg-amber-100 text-amber-800",
  pending: "bg-blue-100 text-blue-800",
  closed: "bg-emerald-100 text-emerald-800"
};

export default function PlatformTicketDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const load = async () => {
    try {
      const data = await fetchJson<TicketDetail>(`/api/platform/support/tickets/${params.id}`);
      setTicket(data);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load ticket");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const sendReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await postVoid(`/api/platform/support/tickets/${params.id}/messages`, { body: reply.trim() });
      setReply("");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to send reply");
    } finally {
      setSending(false);
    }
  };

  const setStatus = async (status: string) => {
    if (!ticket) return;
    setUpdatingStatus(true);
    try {
      await postVoid(`/api/platform/support/tickets/${ticket.id}/status`, { status });
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const escalate = async () => {
    if (!ticket) return;
    setUpdatingStatus(true);
    try {
      await postVoid(`/api/platform/support/tickets/${ticket.id}/status`, {
        assignedRole: "superadmin",
        assignedToUserId: null,
        unassign: true
      });
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to escalate");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const unassign = async () => {
    if (!ticket) return;
    setUpdatingStatus(true);
    try {
      await postVoid(`/api/platform/support/tickets/${ticket.id}/status`, { unassign: true });
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to unassign");
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-slate-600">Loading ticket…</div>;
  }

  if (error && !ticket) {
    return (
      <div className="space-y-4">
        <Link href="/platform/support" className="text-sm font-medium text-slate-600 hover:text-slate-900">
          ← Back to Support
        </Link>
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      </div>
    );
  }

  if (!ticket) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push("/platform/support")}
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          ← Back to Support
        </button>
        <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[ticket.status] ?? "bg-slate-100 text-slate-700"}`}>
          {ticket.status}
        </span>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">{ticket.tenantName}</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">{ticket.subject}</h1>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
          <span>Created by {ticket.createdByName ?? "Unknown"} · {new Date(ticket.createdAt).toLocaleString()}</span>
          <span>Assigned: {ticket.assignedToName ?? "Unassigned"} ({ticket.assignedRole})</span>
          <span>Last updated {new Date(ticket.updatedAt).toLocaleString()}</span>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <StatusActionButton label="Open" color="amber" onClick={() => setStatus("open")} disabled={updatingStatus} />
          <StatusActionButton label="Pending" color="blue" onClick={() => setStatus("pending")} disabled={updatingStatus} />
          <StatusActionButton label="Close" color="emerald" onClick={() => setStatus("closed")} disabled={updatingStatus} />
          <StatusActionButton label="Escalate" color="purple" onClick={escalate} disabled={updatingStatus} />
          <StatusActionButton label="Unassign" color="slate" onClick={unassign} disabled={updatingStatus} />
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Original request</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{ticket.body}</p>
        </div>

        {ticket.messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-2xl border p-5 shadow-sm ${
              m.authorIsPlatform ? "border-indigo-200 bg-indigo-50" : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">
                {m.authorName ?? "Unknown"}
                {m.authorIsPlatform && (
                  <span className="ml-2 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    CertiWatch
                  </span>
                )}
              </p>
              <p className="text-xs text-slate-500">{new Date(m.createdAt).toLocaleString()}</p>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{m.body}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Reply as CertiWatch support</p>
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          rows={4}
          placeholder="Write a reply…"
          className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-slate-400 focus:outline-none"
        />
        <div className="mt-3 flex justify-end">
          <button
            onClick={sendReply}
            disabled={sending || !reply.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending ? "Sending…" : "Send reply"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusActionButton({
  label,
  color,
  onClick,
  disabled
}: {
  label: string;
  color: "amber" | "blue" | "emerald" | "purple" | "slate";
  onClick: () => void;
  disabled?: boolean;
}) {
  const colors: Record<string, string> = {
    amber: "bg-amber-100 text-amber-800 hover:bg-amber-200",
    blue: "bg-blue-100 text-blue-800 hover:bg-blue-200",
    emerald: "bg-emerald-100 text-emerald-800 hover:bg-emerald-200",
    purple: "bg-purple-100 text-purple-800 hover:bg-purple-200",
    slate: "bg-slate-100 text-slate-700 hover:bg-slate-200"
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${colors[color]}`}
    >
      {label}
    </button>
  );
}
