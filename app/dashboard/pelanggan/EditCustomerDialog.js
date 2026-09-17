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
import { Loader2, Phone, User, Wallet } from "lucide-react";
import { updateCustomer } from "@/app/actions/customers";
import { AuthError, authInputClass, authLabelClass } from "@/components/AuthUi";
import { formatIDR } from "@/lib/format";

const emptySubscribe = () => () => {};

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const primaryButtonClass =
  "px-4 py-2.5 rounded-lg bg-violet-500 hover:bg-violet-600 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-violet-500 text-white font-semibold text-xs shadow-md shadow-violet-500/30 dark:shadow-black/30 transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1a1625]";

const secondaryButtonClass =
  "px-4 py-2.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/10 disabled:opacity-60 disabled:cursor-not-allowed font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1a1625]";

const groupFormatter = new Intl.NumberFormat("id-ID");

function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p
      id={id}
      className="mt-1.5 text-[11px] font-medium text-rose-600 dark:text-rose-300"
    >
      {message}
    </p>
  );
}

/**
 * Edit customer dialog. Pre-fills the form with existing customer data.
 * Owner-only action.
 */
export function EditCustomerDialog({ open, onClose, onUpdated, customer }) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const cardRef = useRef(null);
  const nameRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const descriptionId = useId();
  const baseId = useId();

  const [name, setName] = useState(() => customer?.name ?? "");
  const [phone, setPhone] = useState(() => customer?.phoneNumber ?? "");
  const [limitDigits, setLimitDigits] = useState(
    () => (customer ? String(Math.round(Number(customer.creditLimit))) : "")
  );
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const dismissible = !pending;

  useEffect(() => {
    if (!open || !mounted) return;
    const previouslyFocused = document.activeElement;
    const target = nameRef.current;
    if (target) target.focus();
    return () => {
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    };
  }, [open, mounted]);

  useEffect(() => {
    if (!open || !mounted) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, mounted]);

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

  function resetForm() {
    setErrors({});
    setFormError(null);
  }

  function validate() {
    const next = {};
    const cleanName = name.trim();
    if (!cleanName) {
      next.name = "Nama pelanggan wajib diisi.";
    } else if (cleanName.length > 100) {
      next.name = "Nama pelanggan maksimal 100 karakter.";
    }

    const cleanPhone = phone.trim().replace(/[\s-]/g, "");
    if (!/^[0-9+][0-9]{7,15}$/.test(cleanPhone)) {
      next.phone = "Nomor HP tidak valid. Gunakan 9–16 digit angka.";
    }

    const limit = Number(limitDigits || 0);
    if (!Number.isFinite(limit) || limit < 0 || limit > 1_000_000_000) {
      next.limit = "Limit kredit tidak valid. Maksimal Rp 1.000.000.000.";
    }
    return next;
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (pending) return;

    const nextErrors = validate();
    setErrors(nextErrors);
    if (nextErrors.name) {
      nameRef.current?.focus();
      return;
    }
    if (nextErrors.phone) {
      return;
    }
    if (nextErrors.limit) {
      return;
    }
    setFormError(null);

    const payload = {
      id: customer.id,
      name: name.trim(),
      phoneNumber: phone.trim().replace(/[\s-]/g, ""),
      creditLimit: Number(limitDigits || 0),
    };

    startTransition(async () => {
      try {
        const res = await updateCustomer(payload);
        if (res?.ok) {
          resetForm();
          onUpdated?.();
          onCloseRef.current?.();
        } else {
          setFormError(
            res?.error ?? "Gagal mengubah data pelanggan. Silakan coba lagi."
          );
        }
      } catch {
        setFormError("Gagal mengubah data pelanggan. Silakan coba lagi.");
      }
    });
  }

  function handleCancel() {
    if (pending) return;
    resetForm();
    onCloseRef.current?.();
  }

  if (!mounted || !open || !customer) return null;

  const limitPreview = formatIDR(Number(limitDigits || 0));
  const nameErrorId = `${baseId}-name-error`;
  const phoneErrorId = `${baseId}-phone-error`;
  const limitPreviewId = `${baseId}-limit-preview`;
  const limitErrorId = `${baseId}-limit-error`;

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
        data-testid="edit-customer-dialog"
        className="w-full max-w-lg glass-card rounded-2xl border border-white/40 dark:border-white/10 shadow-xl p-5 sm:p-6 animate-fadeIn bg-white/95 dark:bg-[#1a1625]/95"
      >
        <h2
          id={titleId}
          className="text-base font-bold text-gray-900 dark:text-white"
        >
          Edit pelanggan
        </h2>
        <p
          id={descriptionId}
          className="mt-2 text-sm text-gray-600 dark:text-gray-300"
        >
          Ubah data pelanggan {customer.name}.
        </p>

        <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
          {/* Nama pelanggan */}
          <div>
            <label htmlFor={`${baseId}-name`} className={authLabelClass}>
              Nama pelanggan
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                ref={nameRef}
                id={`${baseId}-name`}
                name="name"
                type="text"
                required
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  if (errors.name) {
                    setErrors((prev) => ({ ...prev, name: undefined }));
                  }
                }}
                aria-invalid={errors.name ? "true" : undefined}
                aria-describedby={errors.name ? nameErrorId : undefined}
                placeholder="Nama lengkap pelanggan"
                className={authInputClass}
              />
            </div>
            <FieldError id={nameErrorId} message={errors.name} />
          </div>

          {/* Nomor HP */}
          <div>
            <label htmlFor={`${baseId}-phone`} className={authLabelClass}>
              Nomor HP
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                id={`${baseId}-phone`}
                name="phoneNumber"
                type="tel"
                required
                value={phone}
                onChange={(event) => {
                  setPhone(event.target.value);
                  if (errors.phone) {
                    setErrors((prev) => ({ ...prev, phone: undefined }));
                  }
                }}
                aria-invalid={errors.phone ? "true" : undefined}
                aria-describedby={errors.phone ? phoneErrorId : undefined}
                placeholder="0812xxxxxxx"
                className={authInputClass}
              />
            </div>
            <FieldError id={phoneErrorId} message={errors.phone} />
          </div>

          {/* Limit kredit */}
          <div>
            <label htmlFor={`${baseId}-limit`} className={authLabelClass}>
              Limit kredit
            </label>
            <div className="relative">
              <Wallet className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                id={`${baseId}-limit`}
                name="creditLimit"
                type="text"
                inputMode="numeric"
                value={limitDigits}
                onChange={(event) => {
                  const digits = event.target.value
                    .replace(/\D/g, "")
                    .slice(0, 10);
                  setLimitDigits(digits);
                  if (errors.limit) {
                    setErrors((prev) => ({ ...prev, limit: undefined }));
                  }
                }}
                aria-invalid={errors.limit ? "true" : undefined}
                aria-describedby={
                  errors.limit
                    ? `${limitPreviewId} ${limitErrorId}`
                    : limitPreviewId
                }
                placeholder="0"
                className={authInputClass}
              />
            </div>
            <p
              id={limitPreviewId}
              className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400 tabular-nums"
            >
              Pratinjau: {limitPreview}
            </p>
            <FieldError id={limitErrorId} message={errors.limit} />
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
              disabled={pending}
              className={`${primaryButtonClass} w-full sm:w-auto`}
            >
              {pending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : null}
              {pending ? "Menyimpan…" : "Simpan perubahan"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
