"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import {
  Check,
  Loader2,
  Receipt,
  Search,
  User,
  Wallet,
  X,
} from "lucide-react";
import { createPayment } from "@/app/actions/payments";
import { AuthError, authInputClass, authLabelClass } from "@/components/AuthUi";
import { useToast } from "@/components/Toast";
import { formatIDR } from "@/lib/format";

const emptySubscribe = () => () => {};

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const primaryButtonClass =
  "px-4 py-2.5 rounded-lg bg-violet-500 hover:bg-violet-600 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-violet-500 text-white font-semibold text-xs shadow-md shadow-violet-500/30 dark:shadow-black/30 transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1a1625]";

const violetOutlineButtonClass =
  "px-4 py-2.5 rounded-lg border border-violet-300 dark:border-violet-500/30 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-500/10 disabled:opacity-60 disabled:cursor-not-allowed font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1a1625]";

const secondaryButtonClass =
  "px-4 py-2.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/10 disabled:opacity-60 disabled:cursor-not-allowed font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1a1625]";

const stepBadgeClass =
  "mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-500/15 border border-violet-200 dark:border-violet-500/25 text-[10px] font-bold text-violet-700 dark:text-violet-300 align-middle";

const groupFormatter = new Intl.NumberFormat("id-ID");

/** Inline field-level validation message. */
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
 * Dialog for recording a payment against an active kasbon.
 * Flow: pick a customer (only those with active kasbon are listed), pick one
 * of their kasbon (auto-selected when there is exactly one), then either
 * settle it in full ("Lunas sekaligus") or pay a typed partial amount
 * ("Bayar sebagian"). Validation runs client-side before the server action.
 */
export function NewPaymentDialog({ open, onClose, onSaved, kasbonOptions }) {
  const toast = useToast();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const cardRef = useRef(null);
  const customerInputRef = useRef(null);
  const amountRef = useRef(null);
  const kasbonGroupRef = useRef(null);
  const emptyCloseRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const descriptionId = useId();
  const baseId = useId();

  const [customerQuery, setCustomerQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedKasbonId, setSelectedKasbonId] = useState(null);
  const [amountDigits, setAmountDigits] = useState("");
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [pendingMode, setPendingMode] = useState(null); // "full" | "partial" | null
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const dismissible = !pending;
  const hasOptions = kasbonOptions.length > 0;

  // One entry per customer with at least one active kasbon, carrying their
  // total remaining balance across all of those kasbon.
  const customers = useMemo(() => {
    const byId = new Map();
    for (const kasbon of kasbonOptions) {
      const existing = byId.get(kasbon.customerId);
      if (existing) {
        existing.totalRemaining += kasbon.remaining;
        existing.kasbonCount += 1;
      } else {
        byId.set(kasbon.customerId, {
          id: kasbon.customerId,
          name: kasbon.customerName,
          phoneNumber: kasbon.customerPhone,
          totalRemaining: kasbon.remaining,
          kasbonCount: 1,
        });
      }
    }
    return [...byId.values()].sort((a, b) =>
      a.name.localeCompare(b.name, "id-ID")
    );
  }, [kasbonOptions]);

  const normalizedQuery = customerQuery.trim().toLowerCase();
  const filteredCustomers = useMemo(() => {
    if (!normalizedQuery) return customers;
    return customers.filter(
      (customer) =>
        customer.name.toLowerCase().includes(normalizedQuery) ||
        customer.phoneNumber.toLowerCase().includes(normalizedQuery)
    );
  }, [customers, normalizedQuery]);

  const selectedCustomer =
    customers.find((customer) => customer.id === selectedCustomerId) ?? null;

  const customerKasbon = useMemo(() => {
    if (!selectedCustomer) return [];
    return kasbonOptions.filter(
      (kasbon) => kasbon.customerId === selectedCustomer.id
    );
  }, [kasbonOptions, selectedCustomer]);

  // Explicit user pick, or the lone kasbon auto-selected when the customer
  // has exactly one. Customer switches reset the pick in the event handlers.
  const selectedKasbon =
    customerKasbon.find(
      (kasbon) => kasbon.transactionId === selectedKasbonId
    ) ??
    (customerKasbon.length === 1 ? customerKasbon[0] : null);

  // Move focus into the first field on open; restore it on close.
  useEffect(() => {
    if (!open || !mounted) return;
    const previouslyFocused = document.activeElement;
    const target = customerInputRef.current ?? emptyCloseRef.current;
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

  // Escape to dismiss (unless submitting) + Tab focus trap.
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
    setCustomerQuery("");
    setSelectedCustomerId(null);
    setShowDropdown(false);
    setSelectedKasbonId(null);
    setAmountDigits("");
    setErrors({});
    setFormError(null);
    setPendingMode(null);
  }

  // Shared checks for both submit paths; amount is validated separately
  // because "Lunas sekaligus" does not use the typed amount.
  function validateSelection() {
    const next = {};
    if (!selectedCustomer) {
      next.customer = "Pilih pelanggan terlebih dahulu.";
      return next;
    }
    if (customerKasbon.length === 0) {
      next.kasbon = "Pelanggan ini tidak memiliki utang aktif.";
      return next;
    }
    if (!selectedKasbon) {
      next.kasbon = "Pilih kasbon yang akan dibayar.";
    }
    return next;
  }

  function submitPayment(mode) {
    // Never submit a duplicate request while one is in flight.
    if (pending) return;

    const nextErrors = validateSelection();
    if (mode === "partial" && !nextErrors.customer && !nextErrors.kasbon) {
      const amount = Number(amountDigits || 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        nextErrors.amount = "Jumlah pembayaran harus lebih dari 0.";
      } else if (selectedKasbon && amount > selectedKasbon.remaining) {
        nextErrors.amount = `Jumlah pembayaran melebihi sisa utang (${formatIDR(selectedKasbon.remaining)}).`;
      }
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      // Move focus to the first invalid field.
      if (nextErrors.customer) {
        customerInputRef.current?.focus();
      } else if (nextErrors.kasbon) {
        kasbonGroupRef.current?.querySelector("button")?.focus();
      } else if (nextErrors.amount) {
        amountRef.current?.focus();
      }
      return;
    }
    if (!selectedKasbon) return;

    setFormError(null);
    setPendingMode(mode);
    const amountPaid =
      mode === "full" ? selectedKasbon.remaining : Number(amountDigits);

    startTransition(async () => {
      try {
        const res = await createPayment({
          transactionId: selectedKasbon.transactionId,
          amountPaid,
        });
        if (res?.ok) {
          toast.success("Pembayaran berhasil dicatat.");
          onSaved?.();
        } else {
          setFormError(
            res?.error ?? "Gagal mencatat pembayaran. Silakan coba lagi."
          );
        }
      } catch {
        setFormError("Gagal mencatat pembayaran. Silakan coba lagi.");
      } finally {
        setPendingMode(null);
      }
    });
  }

  function handlePartialSubmit(event) {
    event.preventDefault();
    submitPayment("partial");
  }

  function handleCancel() {
    if (pending) return;
    resetForm();
    onCloseRef.current?.();
  }

  function selectCustomer(customer) {
    setSelectedCustomerId(customer.id);
    setCustomerQuery("");
    setShowDropdown(false);
    // A different customer means a different kasbon list and remaining
    // balance, so the previous kasbon pick and typed amount no longer apply.
    setSelectedKasbonId(null);
    setAmountDigits("");
    setErrors((prev) => ({
      ...prev,
      customer: undefined,
      kasbon: undefined,
      amount: undefined,
    }));
  }

  function handleClearCustomer() {
    setSelectedCustomerId(null);
    setCustomerQuery("");
    setShowDropdown(false);
    setSelectedKasbonId(null);
    setAmountDigits("");
    setErrors((prev) => ({
      ...prev,
      customer: undefined,
      kasbon: undefined,
      amount: undefined,
    }));
  }

  if (!mounted || !open) return null;

  const amountPreview = formatIDR(Number(amountDigits || 0));
  const customerInputId = `${baseId}-customer`;
  const customerErrorId = `${baseId}-customer-error`;
  const kasbonLabelId = `${baseId}-kasbon-label`;
  const kasbonErrorId = `${baseId}-kasbon-error`;
  const amountInputId = `${baseId}-amount`;
  const amountPreviewId = `${baseId}-amount-preview`;
  const amountErrorId = `${baseId}-amount-error`;

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
        data-testid="payment-dialog"
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden glass-card rounded-2xl border border-white/40 dark:border-white/10 shadow-xl animate-fadeIn bg-white/95 dark:bg-[#1a1625]/95"
      >
        <div className="px-5 pt-5 sm:px-6 sm:pt-6">
          <h2
            id={titleId}
            className="text-base font-bold text-gray-900 dark:text-white"
          >
            Catat pembayaran
          </h2>
          <p
            id={descriptionId}
            className="mt-2 text-sm text-gray-600 dark:text-gray-300"
          >
            Pilih pelanggan dan kasbon, lalu masukkan jumlah yang dibayar.
          </p>
        </div>

        {!hasOptions ? (
          <>
            <div className="px-5 sm:px-6 py-4">
              <div className="rounded-xl border border-dashed border-gray-200 dark:border-white/10 px-4 py-8 text-center">
                <div className="w-11 h-11 rounded-2xl bg-violet-100 dark:bg-violet-500/15 border border-violet-200 dark:border-violet-500/25 text-violet-600 dark:text-violet-300 flex items-center justify-center mx-auto mb-3">
                  <Wallet className="w-5 h-5" />
                </div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  Belum ada utang aktif untuk dicatat.
                </p>
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 max-w-xs mx-auto leading-relaxed">
                  Pembayaran hanya bisa dicatat untuk kasbon yang sudah
                  dikonfirmasi dan belum lunas.
                </p>
              </div>
            </div>
            <div className="shrink-0 border-t border-gray-200/70 dark:border-white/10 px-5 sm:px-6 py-4 flex">
              <button
                ref={emptyCloseRef}
                type="button"
                onClick={handleCancel}
                className={`${secondaryButtonClass} w-full sm:w-auto sm:ml-auto`}
              >
                Tutup
              </button>
            </div>
          </>
        ) : (
          <form
            onSubmit={handlePartialSubmit}
            noValidate
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
              {/* Step 1: customer with active kasbon */}
              <div>
                <label htmlFor={customerInputId} className={authLabelClass}>
                  <span aria-hidden="true" className={stepBadgeClass}>
                    1
                  </span>
                  Pelanggan
                </label>
                {selectedCustomer ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-h-10 px-3 py-2 rounded-lg border border-gray-200 dark:border-violet-500/20 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <User className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="truncate font-medium">
                        {selectedCustomer.name}
                      </span>
                      <span className="ml-auto text-[11px] tabular-nums text-gray-500 dark:text-gray-400 shrink-0">
                        Sisa utang {formatIDR(selectedCustomer.totalRemaining)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearCustomer}
                      disabled={pending}
                      className="shrink-0 p-2 rounded-lg text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-60 disabled:cursor-not-allowed"
                      aria-label="Hapus pilihan pelanggan"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                      ref={customerInputRef}
                      id={customerInputId}
                      type="text"
                      value={customerQuery}
                      onChange={(event) => {
                        setCustomerQuery(event.target.value);
                        setShowDropdown(true);
                      }}
                      onFocus={() => {
                        if (!selectedCustomer) setShowDropdown(true);
                      }}
                      placeholder="Cari nama pelanggan…"
                      data-testid="customer-select"
                      aria-invalid={errors.customer ? "true" : undefined}
                      aria-describedby={
                        errors.customer ? customerErrorId : undefined
                      }
                      className={`${authInputClass} pr-9`}
                    />
                    {customerQuery ? (
                      <button
                        type="button"
                        aria-label="Hapus pencarian pelanggan"
                        onClick={() => {
                          setCustomerQuery("");
                          setShowDropdown(true);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    ) : null}

                    {showDropdown ? (
                      <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#241f33]/95 backdrop-blur-xl shadow-lg">
                        {filteredCustomers.length > 0 ? (
                          filteredCustomers.map((customer) => (
                            <button
                              key={customer.id}
                              type="button"
                              onClick={() => selectCustomer(customer)}
                              className="w-full text-left px-3 py-2.5 hover:bg-violet-50 dark:hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-inset"
                            >
                              <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium text-gray-900 dark:text-white">
                                  {customer.name}
                                </span>
                                <span className="block text-[11px] text-gray-400 dark:text-gray-500">
                                  {customer.kasbonCount} kasbon aktif
                                </span>
                              </span>
                              <span className="ml-auto shrink-0 text-right">
                                <span className="block text-xs font-semibold tabular-nums text-gray-900 dark:text-white">
                                  {formatIDR(customer.totalRemaining)}
                                </span>
                                <span className="block text-[11px] text-gray-400 dark:text-gray-500">
                                  sisa utang
                                </span>
                              </span>
                            </button>
                          ))
                        ) : (
                          <p className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400">
                            Tidak ada pelanggan yang cocok.
                          </p>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}
                <FieldError id={customerErrorId} message={errors.customer} />
              </div>

              {/* Step 2: kasbon of the selected customer */}
              {selectedCustomer ? (
                <div>
                  <span id={kasbonLabelId} className={authLabelClass}>
                    <span aria-hidden="true" className={stepBadgeClass}>
                      2
                    </span>
                    Kasbon yang akan dibayar
                  </span>
                  {customerKasbon.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Pelanggan ini tidak memiliki utang aktif.
                    </p>
                  ) : (
                    <div
                      ref={kasbonGroupRef}
                      role="radiogroup"
                      aria-labelledby={kasbonLabelId}
                      className="space-y-2"
                    >
                      {customerKasbon.map((kasbon) => {
                        const isSelected =
                          selectedKasbon?.transactionId ===
                          kasbon.transactionId;
                        return (
                          <button
                            key={kasbon.transactionId}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            data-testid="kasbon-select"
                            disabled={pending}
                            onClick={() => {
                              setSelectedKasbonId(kasbon.transactionId);
                              setErrors((prev) => ({
                                ...prev,
                                kasbon: undefined,
                              }));
                            }}
                            className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-60 disabled:cursor-not-allowed ${
                              isSelected
                                ? "border-violet-500 dark:border-violet-400 bg-violet-50/70 dark:bg-violet-500/10"
                                : "border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 hover:border-violet-300 dark:hover:border-violet-500/40"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <Receipt
                                className={`w-3.5 h-3.5 shrink-0 ${
                                  isSelected
                                    ? "text-violet-500 dark:text-violet-300"
                                    : "text-gray-400"
                                }`}
                              />
                              <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                                {kasbon.transactionNumber}
                              </span>
                              {isSelected ? (
                                <Check className="w-4 h-4 text-violet-500 dark:text-violet-300 ml-auto shrink-0" />
                              ) : null}
                            </span>
                            <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                              <span>Total {kasbon.amountLabel}</span>
                              <span>
                                Sisa{" "}
                                <span className="font-semibold text-gray-700 dark:text-gray-200">
                                  {kasbon.remainingLabel}
                                </span>
                              </span>
                              <span>Jatuh tempo {kasbon.dueDateLabel}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <FieldError id={kasbonErrorId} message={errors.kasbon} />
                </div>
              ) : null}

              {/* Summary of the selected kasbon */}
              {selectedKasbon ? (
                <div
                  className="glass-card relative overflow-hidden rounded-xl p-4"
                  aria-live="polite"
                >
                  <div
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 w-1 bg-violet-500"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-300">
                      Ringkasan kasbon
                    </p>
                    <p className="text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
                      {selectedKasbon.transactionNumber}
                    </p>
                  </div>
                  <dl className="mt-3 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-gray-500 dark:text-gray-400">
                        Total kasbon
                      </dt>
                      <dd className="tabular-nums font-medium text-gray-900 dark:text-white">
                        {selectedKasbon.amountLabel}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-gray-500 dark:text-gray-400">
                        Sudah dibayar
                      </dt>
                      <dd className="tabular-nums font-medium text-gray-900 dark:text-white">
                        {selectedKasbon.paidLabel}
                      </dd>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-3 border-t border-gray-200/70 dark:border-white/10 pt-1.5">
                      <dt className="font-semibold text-gray-700 dark:text-gray-200">
                        Sisa utang
                      </dt>
                      <dd className="tabular-nums text-sm font-bold text-violet-700 dark:text-violet-300">
                        {selectedKasbon.remainingLabel}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : null}

              {/* Step 3: amount paid */}
              <div>
                <label htmlFor={amountInputId} className={authLabelClass}>
                  <span aria-hidden="true" className={stepBadgeClass}>
                    3
                  </span>
                  Jumlah dibayar
                </label>
                <div className="relative">
                  <Wallet className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    ref={amountRef}
                    id={amountInputId}
                    type="text"
                    inputMode="numeric"
                    data-testid="amount-input"
                    value={
                      amountDigits
                        ? groupFormatter.format(Number(amountDigits))
                        : ""
                    }
                    onChange={(event) => {
                      const digits = event.target.value
                        .replace(/\D/g, "")
                        .slice(0, 10);
                      setAmountDigits(digits);
                      if (errors.amount) {
                        setErrors((prev) => ({ ...prev, amount: undefined }));
                      }
                    }}
                    aria-invalid={errors.amount ? "true" : undefined}
                    aria-describedby={
                      errors.amount
                        ? `${amountPreviewId} ${amountErrorId}`
                        : amountPreviewId
                    }
                    placeholder="0"
                    className={authInputClass}
                  />
                </div>
                <p
                  id={amountPreviewId}
                  className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400 tabular-nums"
                >
                  Pratinjau: {amountPreview}
                </p>
                <FieldError id={amountErrorId} message={errors.amount} />
              </div>

              {formError ? <AuthError message={formError} /> : null}
            </div>

            {/* Sticky footer: both submit paths live here. */}
            <div className="shrink-0 border-t border-gray-200/70 dark:border-white/10 bg-white/95 dark:bg-[#241f33]/95 backdrop-blur-xl px-5 sm:px-6 py-4">
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
                  data-testid="partial-payment-btn"
                  disabled={pending}
                  className={`${violetOutlineButtonClass} w-full sm:w-auto`}
                >
                  {pending && pendingMode === "partial" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : null}
                  {pending && pendingMode === "partial"
                    ? "Menyimpan…"
                    : "Bayar sebagian"}
                </button>
                <button
                  type="button"
                  data-testid="full-payment-btn"
                  onClick={() => submitPayment("full")}
                  disabled={pending}
                  className={`${primaryButtonClass} w-full sm:w-auto`}
                >
                  {pending && pendingMode === "full" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : null}
                  {pending && pendingMode === "full"
                    ? "Menyimpan…"
                    : "Lunas sekaligus"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
