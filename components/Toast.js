"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { CheckCircle, X, XCircle } from "lucide-react";

const ToastContext = createContext(null);

const DISMISS_MS = 3000;

const TYPE_STYLES = {
  success:
    "bg-emerald-50/90 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/25 text-emerald-800 dark:text-emerald-200",
  error:
    "bg-rose-50/90 dark:bg-rose-500/15 border-rose-200 dark:border-rose-500/25 text-rose-800 dark:text-rose-200",
};

const ICON_MAP = {
  success: CheckCircle,
  error: XCircle,
};

let toastId = 0;
const timers = new Map();

function clearTimer(id) {
  const t = timers.get(id);
  if (t) {
    clearTimeout(t);
    timers.delete(id);
  }
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimer(id);
  }, []);

  const add = useCallback(
    (message, type = "success") => {
      const id = ++toastId;
      setToasts((prev) => [...prev, { id, message, type }]);
      const timer = setTimeout(() => remove(id), DISMISS_MS);
      timers.set(id, timer);
      return id;
    },
    [remove]
  );

  const toast = useMemo(
    () =>
      Object.assign(
        (message) => add(message, "success"),
        {
          error: (message) => add(message, "error"),
          success: (message) => add(message, "success"),
        }
      ),
    [add]
  );

  useEffect(() => {
    return () => {
      for (const t of timers.values()) clearTimeout(t);
    };
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onRemove={remove} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

function ToastContainer({ toasts, onRemove }) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  if (!mounted || toasts.length === 0) return null;

  return createPortal(
    <div
      aria-live="polite"
      aria-label="Notifikasi"
      className="fixed top-20 right-4 z-[70] flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>,
    document.body
  );
}

function ToastItem({ toast, onRemove }) {
  const Icon = ICON_MAP[toast.type] ?? CheckCircle;

  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-3 w-72 max-w-[calc(100vw-2rem)] px-4 py-3 rounded-xl border shadow-lg backdrop-blur-xl animate-slideIn ${TYPE_STYLES[toast.type] ?? TYPE_STYLES.success}`}
    >
      <Icon className="w-4.5 h-4.5 mt-0.5 shrink-0" />
      <p className="flex-1 text-sm font-medium leading-snug">{toast.message}</p>
      <button
        type="button"
        onClick={() => onRemove(toast.id)}
        aria-label="Tutup notifikasi"
        className="shrink-0 p-0.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
