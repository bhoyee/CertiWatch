"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastKind = "success" | "error";
type ToastItem = { id: number; kind: ToastKind; message: string };

type ToastContextValue = {
  success: (message: string) => void;
  error: (message: string) => void;
};

const noop = () => {};
const ToastContext = createContext<ToastContextValue>({ success: noop, error: noop });

// A page action (create/update/delete) that succeeds silently reads as having done nothing - the
// user has no way to tell "it worked" from "I forgot to click it" without re-checking the list
// themselves. This gives every page a one-line way to confirm an action actually happened (or
// explain why it didn't), mounted once here so any page under this layout can call useToast().
export function useToast() {
  return useContext(ToastContext);
}

const AUTO_DISMISS_MS = 4500;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = ++nextId.current;
      setItems((prev) => [...prev, { id, kind, message }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss]
  );

  const contextValue: ToastContextValue = {
    success: (message) => push("success", message),
    error: (message) => push("error", message)
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {/* Bottom-right, stacked newest-last - the standard toast corner, out of the way of the
          top-right notification bell and any page's own top-of-content banners. */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-2.5 rounded-lg border px-4 py-3 shadow-lg animate-[cw-toast-in_0.2s_ease-out] ${
              item.kind === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            <span className="mt-0.5 flex-shrink-0">{item.kind === "success" ? <CheckIcon /> : <AlertIcon />}</span>
            <p className="flex-1 text-sm font-medium leading-snug">{item.message}</p>
            <button
              onClick={() => dismiss(item.id)}
              aria-label="Dismiss notification"
              className="flex-shrink-0 rounded p-0.5 text-current opacity-60 hover:opacity-100"
            >
              <CloseIcon />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M12 3 2 20h20L12 3Z" strokeLinejoin="round" />
      <path d="M12 10v4M12 17h.01" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  );
}
