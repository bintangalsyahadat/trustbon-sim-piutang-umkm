"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import { Loader2, Wallet } from "lucide-react";
import { updateCustomer } from "@/app/actions/customers";
import { AuthError, authInputClass, authLabelClass } from "@/components/AuthUi";
import { useToast } from "@/components/Toast";

const emptySubscribe = () => () => {};

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Copied verbatim from the "Tambah pelanggan" button (headerPrimaryButtonClass
// in CustomerManagement.js) so the app stays visually consistent.
const triggerButtonClass =
  "inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-sm font-semibold shadow-md shadow-violet-500/25 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500";

const primaryButtonClass =
  "px-4 py-2.5 rounded-lg bg-violet-500 hover:bg-violet-600 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-violet-500 text-white font-semibold text-xs shadow-md shadow-violet-500/30 dark:shadow-black/30 transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1a1625]";

const secondaryButtonClass =
  "px-4 py-2.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/10 disabled:opacity-60 disabled:cursor-not-allowed font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1a1625]";

const fieldErrorClass =
  "mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400";

/** Current limit as a plain digit string, tolerating missing/odd values. */
function currentLimitDigits(customer) {
  const value = Number(customer?.creditLimit);
  return Number.isFinite(value) ? String(Math.round(value)) : "";
}

/** Owner-only trigger for the credit-limit dialog. */
export function EditCreditLimitButton({ customer }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        data-testid="edit-credit-limit"
        onClick={() => setOpen(true)}
        className={triggerButtonClass}
      >
        Edit limit kredit
      </button>
      {open ? (
        <EditCreditLimitDialog
          open
          onClose={() => setOpen(false)}
          onUpdated={() => setOpen(false)}
          customer={customer}
        />
      ) : null}
    </>
  );
}

/**
 * Owner-only dialog that edits a single field (creditLimit) via the shared
 * `updateCustomer` server action, which also validates name/phoneNumber — so
 * we send the unchanged name/phone alongside the new limit.
 *
 * The action accepts `0..1_000_000_000` (it is shared with the 4.1 edit
 * dialog); this 4.5 form additionally requires a strictly positive number.
 */
export function EditCreditLimitDialog({ open, onClose, onUpdated, customer }) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const cardRef = useRef(null);
  const inputRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const descriptionId = useId();
  const baseId = useId();

  const [value, setValue] = useState(() => currentLimitDigits(customer));
  const [error, setError] = useState(null);
  const [formError, setFormError] = useState(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const dismissible = !pending;

  // Move focus into the field on open; restore it on close.
  useEffect(() => {
    if (!open || !mounted) return;
    const previouslyFocused = document.activeElement;
    const target = inputRef.current;
    if (target) target.focus();
    return () => {
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    };
  }, [open, mounted]);

  // Body scroll lock while open.
  useEffect(() => {
    if (!open || !mounted) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, mounted]);

  // Escape closes; Tab cycles within the dialog.
  useEffect(() => {
    if (!open || !mounted) return;
    function onKeyDown(event) {
      if (event.key === "Escape") {
        if (dismissible) {
          event.preventDefault();
          onCloseRef.current?.();
        }
        return;
      }
      if (event.key !== "Tab") return;
      const card = cardRef.current;
      if (!card) return;
      const focusable = card.querySelectorAll(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const inside = card.contains(active);
      if (event.shiftKey) {
        if (!inside || active === first) {
          event.preventDefault();
          last.focus();
        }
        return;
      }
      if (!inside || active === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, mounted, dismissible]);

  function validate(raw) {
    const trimmed = String(raw ?? "").trim();
    if (trimmed === "" || !Number.isFinite(Number(trimmed))) {
      return "Limit kredit wajib diisi dengan angka.";
    }
    const amount = Number(trimmed);
    if (amount <= 0) {
      return "Limit kredit harus lebih besar dari 0.";
    }
    if (amount > 1_000_000_000) {
      return "Limit kredit maksimal Rp1.000.000.000.";
    }
    return null;
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (pending) return;

    const nextError = validate(value);
    setError(nextError);
    if (nextError) {
      inputRef.current?.focus();
      return;
    }
    setFormError(null);

    startTransition(async () => {
      try {
        const res = await updateCustomer({
          id: customer.id,
          name: customer.name,
          phoneNumber: customer.phoneNumber,
          creditLimit: Number(value),
        });
        if (res?.ok) {
          toast.success("Limit kredit berhasil diperbarui.");
          onUpdated?.();
          onCloseRef.current?.();
        } else {
          setFormError(
            res?.error ?? "Gagal memperbarui limit kredit. Silakan coba lagi.",
          );
        }
      } catch {
        setFormError("Gagal memperbarui limit kredit. Silakan coba lagi.");
      }
    });
  }

  function handleCancel() {
    if (pending) return;
    setError(null);
    setFormError(null);
    onCloseRef.current?.();
  }

  if (!mounted || !open || !customer) return null;

  const inputId = `${baseId}-limit`;
  const hintId = `${baseId}-hint`;
  const errorId = `${baseId}-error`;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        if (!dismissible) return;
        onCloseRef.current?.();
      }}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        data-testid="edit-credit-limit-dialog"
        className="w-full max-w-md glass-card rounded-2xl border border-white/40 dark:border-white/10 shadow-xl p-5 sm:p-6 animate-fadeIn bg-white/95 dark:bg-[#1a1625]/95"
      >
        <h2
          id={titleId}
          className="text-base font-bold text-gray-900 dark:text-white"
        >
          Edit limit kredit
        </h2>
        <p
          id={descriptionId}
          className="mt-1 text-xs text-gray-600 dark:text-gray-400 leading-relaxed"
        >
          Ubah batas kasbon untuk {customer.name}.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
          <div>
            <label htmlFor={inputId} className={authLabelClass}>
              Limit Kredit Baru
            </label>
            <div className="relative">
              <Wallet className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                ref={inputRef}
                id={inputId}
                name="creditLimit"
                type="text"
                inputMode="numeric"
                data-testid="credit-limit-input"
                value={value}
                onChange={(event) => {
                  setValue(event.target.value.replace(/\D/g, ""));
                  if (error) setError(null);
                  if (formError) setFormError(null);
                }}
                aria-invalid={error ? "true" : undefined}
                aria-describedby={error ? `${hintId} ${errorId}` : hintId}
                placeholder="0"
                className={authInputClass}
              />
            </div>
            <p
              id={hintId}
              className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400"
            >
              Masukkan angka positif (maks 1.000.000.000).
            </p>
            {error ? (
              <p id={errorId} className={fieldErrorClass}>
                {error}
              </p>
            ) : null}
          </div>

          {formError ? <AuthError message={formError} /> : null}

          <div className="pt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleCancel}
              disabled={pending}
              className={`${secondaryButtonClass} w-full sm:w-auto`}
            >
              Batal
            </button>
            <button
              type="submit"
              data-testid="save-credit-limit"
              disabled={pending}
              className={`${primaryButtonClass} w-full sm:w-auto`}
            >
              {pending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : null}
              {pending ? "Menyimpan…" : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
