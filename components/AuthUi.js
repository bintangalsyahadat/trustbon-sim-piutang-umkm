"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  ArrowLeft,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

/* Shared class recipes — mirror the landing page and auth page conventions:
   inputs with pl-9 leading icons, violet focus border, glass surfaces,
   and the primary violet button with matching shadow tokens. */
export const authInputClass =
  "w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-200 dark:border-violet-500/20 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors";

export const authLabelClass =
  "block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5";

export const authPrimaryButtonClass =
  "w-full py-2.5 px-4 rounded-lg bg-violet-500 hover:bg-violet-600 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-violet-500 text-white font-semibold text-sm shadow-md shadow-violet-500/30 dark:shadow-black/30 transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1a1625]";

export const authLinkClass =
  "text-violet-600 dark:text-violet-400 font-semibold hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500";

/**
 * Shared centered layout for all auth pages: brand mark, glass panel,
 * floating theme toggle, and a quiet link back to the landing page.
 */
export function AuthShell({ children, wide = false }) {
  return (
    <div className="min-h-screen flex flex-col relative selection:bg-violet-500 selection:text-white">
      <div className="fixed top-4 right-4 z-20">
        <ThemeToggle id="auth-theme-toggle" />
      </div>

      <main className="flex-1 flex items-center justify-center px-4 py-12 sm:py-16">
        <div
          className={`w-full animate-fadeIn ${wide ? "max-w-2xl" : "max-w-md"}`}
        >
          {/* Brand identity (matches Navbar logo treatment) */}
          <Link
            href="/"
            className="group flex w-fit mx-auto items-center gap-2.5 mb-7 px-2 py-1 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-4 dark:focus-visible:ring-offset-[#1a1625]"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-violet-500/25 dark:shadow-black/30 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-5 h-5 text-violet-100" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-violet-600 to-violet-500 dark:from-violet-300 dark:to-violet-400 bg-clip-text text-transparent">
                  TrustBon
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-500/10 text-violet-800 dark:text-violet-300 border border-violet-200 dark:border-violet-500/20">
                  UMKM
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium tracking-tight -mt-0.5">
                Skor Risiko Piutang Kasbon
              </p>
            </div>
          </Link>

          <div className="glass-panel rounded-2xl shadow-2xl border border-white/60 dark:border-white/20 p-6 sm:p-8">
            {children}
          </div>

          <div className="mt-6 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke beranda</span>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * Compact 3-step progress indicator for the registration flow.
 */
export function AuthStepper({ current, label }) {
  return (
    <div className="mb-6">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400 mb-2">
        Langkah {current} dari 3 · {label}
      </p>
      <div
        className="flex gap-1.5"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={1}
        aria-valuemax={3}
        aria-label={`Langkah ${current} dari 3: ${label}`}
      >
        {[1, 2, 3].map((step) => (
          <div
            key={step}
            className={`h-1 flex-1 rounded-full transition-colors ${
              step <= current
                ? "bg-violet-500"
                : "bg-gray-200 dark:bg-white/10"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Inline error box with a live region so screen readers announce failures.
 */
export function AuthError({ message }) {
  return (
    <div aria-live="polite">
      {message ? (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 text-rose-700 dark:text-rose-300 text-xs font-medium animate-fadeIn">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
          <span>{message}</span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Inline success box (emerald counterpart of AuthError) for form feedback.
 */
export function AuthSuccess({ message }) {
  return (
    <div aria-live="polite">
      {message ? (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-xs font-medium animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-px" />
          <span>{message}</span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Password field with leading lock icon and a visibility toggle.
 * Forwards all remaining props to the underlying input (name, value,
 * onChange, autoComplete, minLength, placeholder, ...).
 */
export function AuthPasswordInput({ id, label = "Password", helper, ...inputProps }) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className={authLabelClass}>
        {label}
      </label>
      <div className="relative">
        <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          id={id}
          type={visible ? "text" : "password"}
          required
          className={`${authInputClass} pr-10`}
          {...inputProps}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}
          aria-pressed={visible}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        >
          {visible ? (
            <EyeOff className="w-4 h-4" />
          ) : (
            <Eye className="w-4 h-4" />
          )}
        </button>
      </div>
      {helper ? (
        <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
