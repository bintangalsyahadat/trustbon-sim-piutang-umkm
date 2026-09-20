"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toggleAutoReminder } from "@/app/actions/reminders";
import { useToast } from "@/components/Toast";

/**
 * Toggle switch for enabling/disabling auto-reminder on a customer.
 * Owner-only, renders inline on the customer detail page.
 */
export function AutoReminderToggle({ customerId, enabled }) {
  const toast = useToast();
  const [isOn, setIsOn] = useState(enabled);
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    if (pending) return;
    const newValue = !isOn;
    startTransition(async () => {
      try {
        const res = await toggleAutoReminder({
          customerId,
          enabled: newValue,
        });
        if (res?.ok) {
          setIsOn(newValue);
          toast.success(
            newValue
              ? "Pengingat otomatis diaktifkan."
              : "Pengingat otomatis dinonaktifkan."
          );
        } else {
          toast.error(res?.error ?? "Gagal mengubah pengaturan.");
        }
      } catch {
        toast.error("Gagal mengubah pengaturan. Silakan coba lagi.");
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        {isOn ? (
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
          </span>
        ) : (
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M8.7 3A6 6 0 0 1 18 8a21.3 21.3 0 0 0 .6 5"/><path d="M17 17H3s3-2 3-9"/><path d="m4.2 12.4.8-.8"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
          </span>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            Pengingat Otomatis
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {isOn
              ? "Akan menerima pengingat WhatsApp otomatis"
              : "Tidak akan menerima pengingat otomatis"}
          </p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={isOn}
        disabled={pending}
        onClick={handleToggle}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1a1625] disabled:opacity-50 disabled:cursor-not-allowed ${
          isOn
            ? "bg-violet-500"
            : "bg-gray-300 dark:bg-white/15"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
            isOn ? "translate-x-6" : "translate-x-1"
          }`}
        />
        {pending ? (
          <Loader2 className="absolute inset-0 m-auto w-3 h-3 animate-spin text-violet-200" />
        ) : null}
      </button>
    </div>
  );
}
