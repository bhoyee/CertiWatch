"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiUrl, fetchJson, patchJson, postFile, postJson, postVoid } from "../../../lib/api";
import { RichTextContent, RichTextEditor } from "../../../components/RichTextEditor";
import { useRole } from "../RoleContext";

type AttachmentDto = {
  id: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number;
  url: string;
  messageId?: string | null;
  uploadedByName?: string | null;
  createdAt: string;
};

type Ticket = {
  id: string;
  subject: string;
  status: string;
  priority: string;
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
  priority: string;
  assignedRole: string;
  assignedToUserId?: string | null;
  assignedToName?: string | null;
  createdByUserId?: string | null;
  createdByName?: string | null;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  attachments: AttachmentDto[];
};

type UploadedAttachment = { id: string; fileName: string; mimeType: string | null; sizeBytes: number; url: string };

const statusOptions = ["open", "pending", "closed"];
const assignRoles = ["manager", "admin", "support"];
const priorityOptions = ["low", "normal", "high", "urgent"] as const;

const STATUS_STYLES: Record<string, string> = {
  open: "bg-amber-100 text-amber-700",
  pending: "bg-blue-100 text-blue-700",
  closed: "bg-emerald-100 text-emerald-700"
};

const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-slate-100 text-slate-600",
  normal: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700",
  urgent: "bg-rose-100 text-rose-700"
};

const PRIORITY_DOT: Record<string, string> = {
  low: "bg-slate-400",
  normal: "bg-blue-500",
  high: "bg-amber-500",
  urgent: "bg-rose-500"
};

function StatusBadge({ status }: { status: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600"}`}>{status}</span>;
}

function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.normal}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY_DOT[priority] ?? PRIORITY_DOT.normal}`} />
      {priority}
    </span>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentChip({ attachment, onRemove }: { attachment: UploadedAttachment; onRemove?: () => void }) {
  const isImage = (attachment.mimeType ?? "").startsWith("image/");
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 py-1 pl-2 pr-1 text-xs text-slate-700">
      <FileIcon isImage={isImage} />
      <a href={apiUrl(attachment.url)} target="_blank" rel="noreferrer" className="max-w-[160px] truncate font-medium hover:underline">
        {attachment.fileName}
      </a>
      <span className="text-slate-400">{formatBytes(attachment.sizeBytes)}</span>
      {onRemove && (
        <button type="button" onClick={onRemove} className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700" aria-label="Remove attachment">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
            <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </span>
  );
}

function FileIcon({ isImage }: { isImage: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3.5 w-3.5 shrink-0 text-slate-400">
      {isImage ? (
        <>
          <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
          <circle cx="8.5" cy="9.5" r="1.5" fill="currentColor" stroke="none" />
          <path d="m4 17 5-5 3.5 3.5L16 12l4 4" />
        </>
      ) : (
        <>
          <path d="M14 3v5h5" />
          <path d="M7 3h7l5 5v13H7Z" />
        </>
      )}
    </svg>
  );
}

// Attach-files picker used both when composing a new ticket and when replying - uploads
// immediately (files upload to a tenant-scoped holding area not yet tied to any ticket) so the
// user sees each file land right away, and hands back ids that get claimed by the ticket/reply on
// submit.
function AttachFilesButton({
  onUploaded,
  uploading,
  setUploading
}: {
  onUploaded: (attachment: UploadedAttachment) => void;
  uploading: boolean;
  setUploading: (v: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: FileList) => {
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const uploaded = await postFile<UploadedAttachment>("/api/support/attachments", file);
        onUploaded(uploaded);
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3.5 w-3.5">
          <path d="M8 12.5V7a4 4 0 0 1 8 0v7a2.5 2.5 0 0 1-5 0V8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {uploading ? "Uploading..." : "Attach files"}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </div>
  );
}

function PrioritySelector({ value, onChange }: { value: string; onChange: (p: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {priorityOptions.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={`rounded-md border px-2.5 py-1 text-xs font-semibold capitalize transition ${
            value === p ? `${PRIORITY_STYLES[p]} border-transparent` : "border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

function Modal({ children, onClose, title, wide }: { children: React.ReactNode; onClose: () => void; title: string; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className={`w-full ${wide ? "max-w-2xl" : "max-w-lg"} max-h-[90vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-xl`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function SupportPage() {
  const { role } = useRole();
  const isAdmin = role?.toLowerCase() === "admin" || role?.toLowerCase() === "superadmin";

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showNewTicket, setShowNewTicket] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newPriority, setNewPriority] = useState<string>("normal");
  const [newAttachmentIds, setNewAttachmentIds] = useState<string[]>([]);
  const [newFileChips, setNewFileChips] = useState<UploadedAttachment[]>([]);
  const [newUploading, setNewUploading] = useState(false);
  const [creating, setCreating] = useState(false);

  const [replyBody, setReplyBody] = useState("");
  const [replyAttachmentIds, setReplyAttachmentIds] = useState<string[]>([]);
  const [replyFileChips, setReplyFileChips] = useState<UploadedAttachment[]>([]);
  const [replyUploading, setReplyUploading] = useState(false);
  const [replying, setReplying] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingPriority, setUpdatingPriority] = useState(false);
  const [updatingAssign, setUpdatingAssign] = useState(false);

  const [filter, setFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (filter !== "all" && t.status !== filter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      return true;
    });
  }, [tickets, filter, priorityFilter]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredTickets.length / pageSize)), [filteredTickets.length]);
  const pagedTickets = useMemo(() => filteredTickets.slice((page - 1) * pageSize, page * pageSize), [filteredTickets, page, pageSize]);

  const openCount = useMemo(() => tickets.filter((t) => t.status === "open").length, [tickets]);
  const urgentCount = useMemo(() => tickets.filter((t) => t.priority === "urgent" && t.status !== "closed").length, [tickets]);

  useEffect(() => {
    void loadTickets();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [filter, priorityFilter]);

  useEffect(() => {
    setPage((p) => Math.min(Math.max(p, 1), totalPages));
  }, [totalPages]);

  async function loadTickets() {
    setTicketsLoading(true);
    setError(null);
    try {
      const data = await fetchJson<Ticket[]>("/api/support/tickets");
      setTickets(data);
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
    const plainText = newBody.replace(/<[^>]*>/g, "").trim();
    if (!newSubject.trim() || !plainText) {
      setError("Subject and description are required");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await postJson<{ id: string }, Record<string, unknown>>("/api/support/tickets", {
        subject: newSubject.trim(),
        body: newBody,
        priority: newPriority,
        attachmentIds: newAttachmentIds
      });
      setNewSubject("");
      setNewBody("");
      setNewPriority("normal");
      setNewAttachmentIds([]);
      setNewFileChips([]);
      setShowNewTicket(false);
      await loadTickets();
    } catch (e: any) {
      setError(e.message ?? "Failed to create ticket");
    } finally {
      setCreating(false);
    }
  }

  async function sendReply() {
    const plainText = replyBody.replace(/<[^>]*>/g, "").trim();
    if (!detail || !plainText) return;
    setReplying(true);
    setError(null);
    try {
      await postVoid(`/api/support/tickets/${detail.id}/messages`, { body: replyBody, attachmentIds: replyAttachmentIds });
      setReplyBody("");
      setReplyAttachmentIds([]);
      setReplyFileChips([]);
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

  async function changePriority(priority: string) {
    if (!detail) return;
    setUpdatingPriority(true);
    setError(null);
    try {
      await patchJson(`/api/support/tickets/${detail.id}/priority`, { priority });
      await Promise.all([loadDetail(detail.id), loadTickets()]);
    } catch (e: any) {
      setError(e.message ?? "Failed to update priority");
    } finally {
      setUpdatingPriority(false);
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

  const uploadInlineImage = async (file: File): Promise<string> => {
    const uploaded = await postFile<UploadedAttachment>("/api/support/attachments", file);
    setNewAttachmentIds((prev) => [...prev, uploaded.id]);
    return apiUrl(uploaded.url);
  };

  const uploadInlineImageForReply = async (file: File): Promise<string> => {
    const uploaded = await postFile<UploadedAttachment>("/api/support/attachments", file);
    setReplyAttachmentIds((prev) => [...prev, uploaded.id]);
    return apiUrl(uploaded.url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 text-white shadow-sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
              <path d="M12 18h.01" strokeLinecap="round" />
              <path d="M9.5 9a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1.4.9-1.4 1.9v.3" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="9" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Support</h1>
            <p className="text-sm text-slate-600">Raise tickets to your manager, admin, or support. Access is scoped by your role.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadTickets}
            disabled={ticketsLoading}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {ticketsLoading ? "Refreshing..." : "Refresh"}
          </button>
          <button
            onClick={() => setShowNewTicket(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-indigo-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            New ticket
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Total tickets" value={tickets.length} tone="slate" />
        <SummaryCard label="Open" value={openCount} tone="amber" />
        <SummaryCard label="Urgent (unresolved)" value={urgentCount} tone="rose" />
        <SummaryCard label="Closed" value={tickets.filter((t) => t.status === "closed").length} tone="emerald" />
      </div>

      {error && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Tickets</h2>
              <div className="flex items-center gap-1.5">
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
                >
                  <option value="all">All statuses</option>
                  <option value="open">Open</option>
                  <option value="pending">Pending</option>
                  <option value="closed">Closed</option>
                </select>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
                >
                  <option value="all">All priorities</option>
                  {priorityOptions.map((p) => (
                    <option key={p} value={p} className="capitalize">
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="max-h-[560px] divide-y divide-slate-100 overflow-y-auto">
              {pagedTickets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => void loadDetail(t.id)}
                  className={`w-full px-4 py-3 text-left transition hover:bg-slate-50 ${detail?.id === t.id ? "bg-indigo-50" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900">{t.subject}</p>
                    <StatusBadge status={t.status} />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <PriorityBadge priority={t.priority} />
                    <span className="text-xs text-slate-500">{new Date(t.updatedAt).toLocaleDateString()}</span>
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-500">Assigned: {t.assignedToName || t.assignedRole || "Unassigned"}</p>
                </button>
              ))}
              {!filteredTickets.length && <div className="px-4 py-8 text-center text-sm text-slate-500">No tickets match your filters.</div>}
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-600">
              <span>
                {filteredTickets.length === 0
                  ? "No tickets"
                  : `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, filteredTickets.length)} of ${filteredTickets.length}`}
              </span>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-md border border-slate-200 px-2 py-1 hover:bg-slate-50 disabled:opacity-50"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || filteredTickets.length === 0}
                >
                  Prev
                </button>
                <span className="text-slate-700">
                  {page} / {totalPages}
                </span>
                <button
                  className="rounded-md border border-slate-200 px-2 py-1 hover:bg-slate-50 disabled:opacity-50"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || filteredTickets.length === 0}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-3">
          {!detail && !detailLoading && (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center text-slate-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-12 w-12">
                <path d="M8 10h8M8 14h5" strokeLinecap="round" />
                <path d="M21 12c0 4.4-4 8-9 8a9.7 9.7 0 0 1-3.3-.6L3 21l1.8-4A7.9 7.9 0 0 1 3 12c0-4.4 4-8 9-8s9 3.6 9 8Z" strokeLinejoin="round" />
              </svg>
              <p className="mt-3 text-sm">Select a ticket to see its details</p>
            </div>
          )}

          {detailLoading && <div className="text-sm text-slate-600">Loading...</div>}

          {detail && !detailLoading && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ticket detail</p>
                  <h2 className="mt-0.5 text-lg font-semibold text-slate-900">{detail.subject}</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Created {new Date(detail.createdAt).toLocaleString()} by {detail.createdByName ?? "Unknown"} - Updated{" "}
                    {new Date(detail.updatedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={detail.status} />
                  <PriorityBadge priority={detail.priority} />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-500">Status</span>
                  <select
                    value={detail.status}
                    onChange={(e) => void changeStatus(e.target.value)}
                    disabled={updatingStatus}
                    className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs capitalize focus:border-indigo-500 focus:outline-none"
                  >
                    {statusOptions.map((s) => (
                      <option key={s} value={s} className="capitalize">
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-500">Priority</span>
                  <select
                    value={detail.priority}
                    onChange={(e) => void changePriority(e.target.value)}
                    disabled={updatingPriority}
                    className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs capitalize focus:border-indigo-500 focus:outline-none"
                  >
                    {priorityOptions.map((p) => (
                      <option key={p} value={p} className="capitalize">
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                {(isAdmin || role?.toLowerCase() === "manager") && (
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-500">Assigned to</span>
                    <select
                      value={detail.assignedRole}
                      onChange={(e) => void changeAssignment(e.target.value)}
                      disabled={updatingAssign}
                      className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs capitalize focus:border-indigo-500 focus:outline-none"
                    >
                      {assignRoles.map((r) => (
                        <option key={r} value={r} className="capitalize">
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {!isAdmin && role?.toLowerCase() !== "manager" && (
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-500">Assigned to</span>
                    <span className="text-slate-700">{detail.assignedToName || detail.assignedRole}</span>
                  </div>
                )}
              </div>

              <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                {detail.messages.map((m, i) => {
                  const isOpening = i === 0;
                  const msgAttachments = detail.attachments.filter((a) => a.messageId === m.id && !m.body.includes(a.url));
                  return (
                    <div
                      key={m.id}
                      className={`rounded-lg border p-3 ${isOpening ? "border-indigo-100 bg-indigo-50/40" : "border-slate-100 bg-white"}`}
                    >
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">
                          {m.authorName ?? "System"}
                          {isOpening && <span className="ml-2 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">Original request</span>}
                        </span>
                        <span>{new Date(m.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="mt-2">
                        <RichTextContent html={m.body} />
                      </div>
                      {msgAttachments.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5 border-t border-slate-100 pt-2">
                          {msgAttachments.map((a) => (
                            <AttachmentChip key={a.id} attachment={a} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {!detail.messages.length && <div className="text-xs text-slate-500">No messages yet.</div>}
              </div>

              <div className="space-y-2 border-t border-slate-200 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reply</p>
                <RichTextEditor value={replyBody} onChange={setReplyBody} onUploadImage={uploadInlineImageForReply} placeholder="Write a reply..." />
                {replyFileChips.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {replyFileChips.map((f) => (
                      <AttachmentChip
                        key={f.id}
                        attachment={f}
                        onRemove={() => {
                          setReplyFileChips((prev) => prev.filter((x) => x.id !== f.id));
                          setReplyAttachmentIds((prev) => prev.filter((id) => id !== f.id));
                        }}
                      />
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <AttachFilesButton
                    uploading={replyUploading}
                    setUploading={setReplyUploading}
                    onUploaded={(a) => {
                      setReplyFileChips((prev) => [...prev, a]);
                      setReplyAttachmentIds((prev) => [...prev, a.id]);
                    }}
                  />
                  <button
                    onClick={sendReply}
                    disabled={replying || replyUploading}
                    className="inline-flex items-center rounded-md bg-gradient-to-r from-indigo-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50"
                  >
                    {replying ? "Sending..." : "Send reply"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showNewTicket && (
        <Modal title="New support ticket" onClose={() => !creating && setShowNewTicket(false)} wide>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600">Subject</label>
              <input
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                className="mt-1 w-full rounded-md border-2 border-slate-300 px-3 py-2 text-sm shadow-inner transition focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100"
                placeholder="Brief summary of the issue"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600">Priority</label>
              <div className="mt-1.5">
                <PrioritySelector value={newPriority} onChange={setNewPriority} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600">Description</label>
              <div className="mt-1">
                <RichTextEditor value={newBody} onChange={setNewBody} onUploadImage={uploadInlineImage} placeholder="Describe the issue or request in detail..." />
              </div>
            </div>
            {newFileChips.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {newFileChips.map((f) => (
                  <AttachmentChip
                    key={f.id}
                    attachment={f}
                    onRemove={() => {
                      setNewFileChips((prev) => prev.filter((x) => x.id !== f.id));
                      setNewAttachmentIds((prev) => prev.filter((id) => id !== f.id));
                    }}
                  />
                ))}
              </div>
            )}
            <div className="flex items-center justify-between gap-3 pt-1">
              <AttachFilesButton
                uploading={newUploading}
                setUploading={setNewUploading}
                onUploaded={(a) => {
                  setNewFileChips((prev) => [...prev, a]);
                  setNewAttachmentIds((prev) => [...prev, a.id]);
                }}
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={creating}
                  onClick={() => setShowNewTicket(false)}
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={createTicket}
                  disabled={creating || newUploading}
                  className="inline-flex items-center rounded-md bg-gradient-to-r from-indigo-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50"
                >
                  {creating ? "Submitting..." : "Submit ticket"}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: "slate" | "amber" | "rose" | "emerald" }) {
  const tints: Record<string, string> = {
    slate: "border-slate-200 bg-slate-50/70",
    amber: "border-amber-100 bg-amber-50/70",
    rose: "border-rose-100 bg-rose-50/70",
    emerald: "border-emerald-100 bg-emerald-50/70"
  };
  const lines: Record<string, string> = {
    slate: "bg-slate-300",
    amber: "bg-amber-400",
    rose: "bg-rose-400",
    emerald: "bg-emerald-400"
  };
  return (
    <div className={`rounded-xl border p-3 shadow-sm ${tints[tone]}`}>
      <p className="text-xs text-slate-600">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      <div className={`mt-2 h-0.5 w-full rounded-full ${lines[tone]}`} />
    </div>
  );
}
