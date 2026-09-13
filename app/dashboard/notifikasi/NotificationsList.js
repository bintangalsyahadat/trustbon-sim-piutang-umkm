"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  UserPlus,
  UserMinus,
  CheckCircle2,
  XCircle,
  BellOff,
  Check,
  CheckCheck,
  ChevronRight,
  Loader2,
} from "lucide-react";
import {
  markNotificationsRead,
  markNotificationRead,
} from "@/app/actions/notifications";
import { AuthError } from "@/components/AuthUi";

const TYPE_STYLES = {
  join_request: {
    icon: UserPlus,
    tile: "bg-amber-100 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/25 text-amber-600 dark:text-amber-300",
  },
  join_approved: {
    icon: CheckCircle2,
    tile: "bg-emerald-100 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/25 text-emerald-600 dark:text-emerald-300",
  },
  join_rejected: {
    icon: XCircle,
    tile: "bg-rose-100 dark:bg-rose-500/15 border-rose-200 dark:border-rose-500/25 text-rose-600 dark:text-rose-300",
  },
  member_removed: {
    icon: UserMinus,
    tile: "bg-rose-100 dark:bg-rose-500/15 border-rose-200 dark:border-rose-500/25 text-rose-600 dark:text-rose-300",
  },
};

/**
 * Interactive notification list. Read state is updated locally right away
 * and the layout's unread badge is synced via router.refresh().
 */
export function NotificationsList({ items: initialItems }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();

  const unreadCount = items.filter((i) => !i.read).length;

  function runAction(action, applyLocal) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (res?.ok) {
        applyLocal();
        router.refresh();
      } else {
        setError(res?.error ?? "Gagal memperbarui notifikasi.");
      }
    });
  }

  function markAll() {
    if (pending || unreadCount === 0) return;
    runAction(markNotificationsRead, () =>
      setItems((prev) => prev.map((i) => ({ ...i, read: true })))
    );
  }

  function markOne(item) {
    if (pending || item.read) return;
    runAction(
      () => markNotificationRead(item.id),
      () =>
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, read: true } : i))
        )
    );
  }

  function openItem(item) {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      if (!item.read) {
        const res = await markNotificationRead(item.id);
        if (!res?.ok) {
          setError(res?.error ?? "Gagal memperbarui notifikasi.");
          return;
        }
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, read: true } : i))
        );
      }
      if (item.href) {
        router.push(item.href);
      }
      router.refresh();
    });
  }

  if (items.length === 0) {
    return (
      <div className="mt-8 glass-card rounded-2xl border border-white/40 dark:border-white/10 shadow-md p-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-violet-100 dark:bg-violet-500/15 border border-violet-200 dark:border-violet-500/25 text-violet-600 dark:text-violet-300 flex items-center justify-center mx-auto mb-3">
          <BellOff className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">
          Belum ada notifikasi
        </h3>
        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">
          Permintaan bergabung dan kabar akun lainnya akan muncul di sini.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {unreadCount > 0
            ? `${unreadCount} notifikasi belum dibaca`
            : "Semua notifikasi sudah dibaca"}
        </p>
        <button
          type="button"
          onClick={markAll}
          disabled={pending || unreadCount === 0}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-500/20 bg-white/70 dark:bg-white/5 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        >
          {pending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <CheckCheck className="w-3.5 h-3.5" />
          )}
          <span>Tandai semua dibaca</span>
        </button>
      </div>

      <AuthError message={error} />

      <div className="mt-3 space-y-3">
        {items.map((item) => {
          const style = TYPE_STYLES[item.type] ?? TYPE_STYLES.join_request;
          const Icon = style.icon;
          return (
            <div
              key={item.id}
              role={item.href ? "button" : undefined}
              tabIndex={item.href ? 0 : undefined}
              onClick={item.href ? () => openItem(item) : undefined}
              onKeyDown={
                item.href
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openItem(item);
                      }
                    }
                  : undefined
              }
              className={`glass-card rounded-2xl border shadow-md p-4 sm:p-5 flex items-start gap-3 transition-all ${
                item.href
                  ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-lg hover:border-violet-300 dark:hover:border-violet-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                  : ""
              } ${
                item.read
                  ? "border-white/40 dark:border-white/10 opacity-70"
                  : "border-violet-200 dark:border-violet-500/25"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${style.tile}`}
              >
                <Icon className="w-5 h-5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3
                    className={`text-sm truncate ${
                      item.read
                        ? "font-semibold text-gray-700 dark:text-gray-300"
                        : "font-bold text-gray-900 dark:text-white"
                    }`}
                  >
                    {item.title}
                  </h3>
                  {!item.read ? (
                    <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />
                  ) : null}
                </div>
                {item.body ? (
                  <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400 leading-relaxed break-words">
                    {item.body}
                  </p>
                ) : null}
                <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-500">
                  {item.dateLabel}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 self-center">
                {!item.read ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      markOne(item);
                    }}
                    disabled={pending}
                    aria-label="Tandai dibaca"
                    title="Tandai dibaca"
                    className="p-2 rounded-lg text-gray-400 hover:text-violet-600 dark:hover:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors cursor-pointer disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                ) : null}
                {item.href ? (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
