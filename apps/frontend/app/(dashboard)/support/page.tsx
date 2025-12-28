"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchJson, postJson, patchJson } from "../../../lib/api";
import { useRole } from "../RoleContext";

type Ticket = {
  id: string;
  subject: string;
  status: string;
  assignedRole: string;
  assignedToUserId?: string | null;
  assignedToName?: string | null;
  createdByUserId?: string | null;
  createdByName?: string | null;
  createdAt: string;
  updatedAt: string;
};

type Message = {
  id: string;
  authorUserId?: string | null;
  authorName?: string | null;
  body: string;
  createdAt: string;
};

type TicketDetail = {
  id: string;
  subject: string;
  body: string;
  status: string;
  assignedRole: string;
  assignedToUserId?: string | null;
  assignedToName?: string | null;
  createdByUserId?: string | null;
  createdByName?: string | null;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
};

const statusOptions = ["open", "pending", "closed"];
const assignRoles = ["manager", "admin", "support"];

export default function SupportPage() {
  const { role } = useRole();
  const isAdmin = role?.toLowerCase() === "admin" || role?.toLowerCase() === "superadmin";

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");
  const [creating, setCreating] = useState(false);

  const [replyBody, setReplyBody] = useState("");
  const [replying, setReplying] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingAssign, setUpdatingAssign] = useState(false);

  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filteredTickets = useMemo(() => {
    if (filter === "open") return tickets.filter(t => t.status === "open");
    if (filter === "pending") return tickets.filter(t => t.status === "pending");
    if (filter === "closed") return tickets.filter(t => t.status === "closed");
    return tickets;
  }, [tickets, filter]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredTickets.length / pageSize)), [filteredTickets.length]);
  const pagedTickets = useMemo(
    () => filteredTickets.slice((page - 1) * pageSize, page * pageSize),
    [filteredTickets, page, pageSize]
  );

  useEffect(() => {
    void loadTickets();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [filter]);

  useEffect(() => {
    setPage(p => Math.min(Math.max(p, 1), totalPages));
  }, [totalPages]);

  async function loadTickets() {
    setTicketsLoading(true);
    setError(null);
    try {
      const data = await fetchJson<Ticket[]>("/api/support/tickets");
      setTickets(data);
      setPage(1);
      if (data.length && !detail) {
        void loadDetail(data[0].id);
      }
    } catch (e: any) {
      setError(e.message ?? "Failed to load tickets");
    } finally {
      setTicketsLoading(false);
    }
  }

  async function loadDetail(id: string) {
    setDetailLoading(true);
    setError(null);
    try {
      const data = await fetchJson<TicketDetail>(`/api/support/tickets/${id}`);
      setDetail(data);
    } catch (e: any) {
      setError(e.message ?? "Failed to load ticket");
    } finally {
      setDetailLoading(false);
    }
  }

  async function createTicket() {
    if (!newSubject.trim() || !newBody.trim()) {
      setError("Subject and description are required");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await postJson<{ id: string }, { subject: string; body: string }>("/api/support/tickets", {
        subject: newSubject.trim(),
        body: newBody.trim()
      });
      setNewSubject("");
      setNewBody("");
      await loadTickets();
    } catch (e: any) {
      setError(e.message ?? "Failed to create ticket");
    } finally {
      setCreating(false);
    }
  }

  async function sendReply() {
    if (!detail || !replyBody.trim()) return;
    setReplying(true);
    setError(null);
    try {
      await postJson(`/api/support/tickets/${detail.id}/messages`, { body: replyBody.trim() });
      setReplyBody("");
      await loadDetail(detail.id);
    } catch (e: any) {
      setError(e.message ?? "Failed to send reply");
    } finally {
      setReplying(false);
    }
  }

  async function changeStatus(status: string) {
    if (!detail) return;
    setUpdatingStatus(true);
    setError(null);
    try {
      await patchJson(`/api/support/tickets/${detail.id}/status`, { status });
      await Promise.all([loadDetail(detail.id), loadTickets()]);
    } catch (e: any) {
      setError(e.message ?? "Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function changeAssignment(role: string) {
    if (!detail) return;
    setUpdatingAssign(true);
    setError(null);
    try {
      await patchJson(`/api/support/tickets/${detail.id}/assign`, { assignedRole: role });
      await loadDetail(detail.id);
    } catch (e: any) {
      setError(e.message ?? "Failed to update assignment");
    } finally {
      setUpdatingAssign(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Support</h1>
          <p className="text-slate-600">
            Raise tickets to your manager/admin/support. Your access is scoped by your role.
          </p>
        </div>
        <button
          onClick={loadTickets}
          className="inline-flex items-center rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          disabled={ticketsLoading}
        >
          {ticketsLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">New ticket</h2>
            <div className="mt-3 space-y-3">
              <input
                value={newSubject}
                onChange={e => setNewSubject(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                placeholder="Subject"
              />
              <textarea
                value={newBody}
                onChange={e => setNewBody(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                rows={4}
                placeholder="Describe the issue or request"
              />
              <button
                onClick={createTicket}
                disabled={creating}
                className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {creating ? "Sending..." : "Submit ticket"}
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Tickets</h2>
              <div className="flex items-center gap-2 text-xs">
                <label className="text-slate-600">Filter:</label>
                <select
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
                >
                  <option value="all">All</option>
                  <option value="open">Open</option>
                  <option value="pending">Pending</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>
            <div className="max-h-[520px] divide-y divide-slate-200 overflow-y-auto">
              {pagedTickets.map(t => (
                <button
                  key={t.id}
                  onClick={() => void loadDetail(t.id)}
                  className={`w-full px-4 py-3 text-left transition hover:bg-slate-50 ${
                    detail?.id === t.id ? "bg-indigo-50" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">{t.subject}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      t.status === "open"
                        ? "bg-amber-100 text-amber-700"
                        : t.status === "pending"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}>
                      {t.status}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-slate-600">
                    <span>Assigned: {t.assignedToName || t.assignedRole || "Unassigned"}</span>
                    <span>{new Date(t.updatedAt).toLocaleString()}</span>
                  </div>
                </button>
              ))}
              {!filteredTickets.length && (
                <div className="px-4 py-6 text-center text-sm text-slate-600">No tickets yet.</div>
              )}
            </div>

            {filteredTickets.length > 0 && (
              <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-600">
                <span>
                  Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filteredTickets.length)} of {filteredTickets.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-md border border-slate-200 px-2 py-1 hover:bg-slate-50 disabled:opacity-50"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Prev
                  </button>
                  <span className="text-slate-700">Page {page} / {totalPages}</span>
                  <button
                    className="rounded-md border border-slate-200 px-2 py-1 hover:bg-slate-50 disabled:opacity-50"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase text-slate-500">Ticket detail</p>
              <h2 className="text-lg font-semibold text-slate-900">{detail?.subject || "Select a ticket"}</h2>
              {detail && (
                <p className="mt-1 text-xs text-slate-600">
                  Created {new Date(detail.createdAt).toLocaleString()} by {detail.createdByName ?? detail.createdByUserId ?? "Unknown"} - Updated {new Date(detail.updatedAt).toLocaleString()}
                </p>
              )}
            </div>
            {detail && (
              <div className="flex items-center gap-2 text-xs">
                <span className={`rounded-full px-2 py-0.5 font-medium ${
                  detail.status === "open"
                    ? "bg-amber-100 text-amber-700"
                    : detail.status === "pending"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-emerald-100 text-emerald-700"
                }`}>{detail.status}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                  assigned: {detail.assignedToName || detail.assignedRole || "Unassigned"}
                </span>
              </div>
            )}
          </div>

          {detailLoading && <div className="mt-4 text-sm text-slate-600">Loadingâ€¦</div>}

          {detail && !detailLoading && (
            <div className="mt-4 space-y-4">
              <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-800">{detail.body}</p>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Messages</p>
                <div className="max-h-[260px] space-y-2 overflow-y-auto rounded-md border border-slate-200 p-3">
                  {detail.messages.map(m => (
                    <div key={m.id} className="rounded border border-slate-100 bg-white px-2 py-1.5 text-sm text-slate-800">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>{m.authorName ?? m.authorUserId ?? "System"}</span>
                        <span>{new Date(m.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
                    </div>
                  ))}
                  {!detail.messages.length && <div className="text-xs text-slate-500">No messages yet.</div>}
                </div>

                <textarea
                  value={replyBody}
                  onChange={e => setReplyBody(e.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  rows={3}
                  placeholder="Add a reply"
                />
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={sendReply}
                    disabled={replying || !replyBody.trim()}
                    className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {replying ? "Sending..." : "Send reply"}
                  </button>

                  <label className="text-xs text-slate-600">Status:</label>
                  <select
                    value={detail.status}
                    onChange={e => void changeStatus(e.target.value)}
                    disabled={updatingStatus}
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
                  >
                    {statusOptions.map(s => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>

                  {(isAdmin || role?.toLowerCase() === "manager") && (
                    <>
                      <label className="text-xs text-slate-600">Assign to:</label>
                      <select
                        value={detail.assignedRole}
                        onChange={e => void changeAssignment(e.target.value)}
                        disabled={updatingAssign}
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
                      >
                        {assignRoles.map(r => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}























