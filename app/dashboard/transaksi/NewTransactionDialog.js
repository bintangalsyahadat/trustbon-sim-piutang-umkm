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
  CalendarDays,
  FileText,
  Loader2,
  Phone,
  Search,
  User,
  UserPlus,
  Wallet,
  X,
} from "lucide-react";
import { createCustomer } from "@/app/actions/customers";
import { createTransaction } from "@/app/actions/transactions";
import { AuthError, authInputClass, authLabelClass } from "@/components/AuthUi";
import {
  RiskScoreBadge,
  TrustStatusBadge,
} from "@/components/dashboard/StatusBadge";
import { useToast } from "@/components/Toast";
import { formatIDR } from "@/lib/format";

const emptySubscribe = () => () => {};

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const primaryButtonClass =
  "px-4 py-2.5 rounded-lg bg-violet-500 hover:bg-violet-600 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-violet-500 text-white font-semibold text-xs shadow-md shadow-violet-500/30 dark:shadow-black/30 transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1a1625]";

const secondaryButtonClass =
  "px-4 py-2.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/10 disabled:opacity-60 disabled:cursor-not-allowed font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1a1625]";

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

function todayLocal() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Dialog form for creating a new credit transaction.
 * Includes a searchable customer dropdown with inline "add new customer"
 * and a credit-limit info box after selection.
 */
export function NewTransactionDialog({
  open,
  onClose,
  onCreated,
  customers,
  userRole,
}) {
  const toast = useToast();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const cardRef = useRef(null);
  const customerInputRef = useRef(null);
  const amountRef = useRef(null);
  const dueDateRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const descriptionId = useId();
  const baseId = useId();

  const [customerQuery, setCustomerQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [amountDigits, setAmountDigits] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const dismissible = !pending;

  const normalizedQuery = customerQuery.trim().toLowerCase();
  const filteredCustomers = useMemo(() => {
    if (!normalizedQuery) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(normalizedQuery) ||
        c.phoneNumber.toLowerCase().includes(normalizedQuery)
    );
  }, [customers, normalizedQuery]);

  useEffect(() => {
    if (!open || !mounted) return;
    const previouslyFocused = document.activeElement;
    const target = customerInputRef.current;
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
    setCustomerQuery("");
    setSelectedCustomer(null);
    setShowDropdown(false);
    setShowNewCustomerForm(false);
    setNewName("");
    setNewPhone("");
    setAmountDigits("");
    setDueDate("");
    setNote("");
    setErrors({});
    setFormError(null);
  }

  function validate() {
    const next = {};
    if (!selectedCustomer && !showNewCustomerForm) {
      next.customer = "Pilih pelanggan atau tambahkan yang baru.";
    }
    if (showNewCustomerForm && !selectedCustomer) {
      const cleanName = newName.trim();
      if (!cleanName) {
        next.newName = "Nama pelanggan wajib diisi.";
      } else if (cleanName.length > 100) {
        next.newName = "Nama pelanggan maksimal 100 karakter.";
      }
      const cleanPhone = newPhone.trim().replace(/[\s-]/g, "");
      if (!/^[0-9+][0-9]{7,15}$/.test(cleanPhone)) {
        next.newPhone = "Nomor HP tidak valid. Gunakan 9–16 digit angka.";
      }
    }

    const amount = Number(amountDigits || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      next.amount = "Nominal harus lebih dari 0.";
    }

    if (!dueDate) {
      next.dueDate = "Tanggal jatuh tempo wajib diisi.";
    } else {
      const parsed = new Date(dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (!Number.isFinite(parsed.getTime()) || parsed < today) {
        next.dueDate = "Tanggal jatuh tempo tidak boleh di masa lalu.";
      }
    }

    return next;
  }

  async function doSubmit() {
    startTransition(async () => {
      try {
        let customerId = selectedCustomer?.id;

        if (!customerId && showNewCustomerForm) {
          const custRes = await createCustomer({
            name: newName.trim(),
            phoneNumber: newPhone.trim().replace(/[\s-]/g, ""),
            creditLimit: 100000,
          });
          if (!custRes?.ok) {
            setFormError(
              custRes?.error ?? "Gagal menambahkan pelanggan baru."
            );
            return;
          }
          customerId = custRes.customerId;
        }

        if (!customerId) {
          setFormError("Pilih pelanggan atau tambahkan yang baru.");
          return;
        }

        const amount = Number(amountDigits);
        const res = await createTransaction({
          customerId,
          amount,
          dueDate,
          note: note.trim() || undefined,
        });

        if (res?.ok) {
          if (res.paymentStatus === "need_approval") {
            const msgs = ["Transaksi melebihi limit kredit, menunggu persetujuan Owner."];
            if (res.pendingApprovalCount > 0) {
              msgs.push(`Peringatan: pelanggan ini memiliki ${res.pendingApprovalCount} transaksi lain yang juga menunggu persetujuan.`);
            }
            toast.info(msgs.join(" "));
          } else {
            toast.success("Transaksi berhasil dibuat dan dikonfirmasi.");
          }
          resetForm();
          onCreated?.();
          onCloseRef.current?.();
        } else {
          setFormError(
            res?.error ?? "Gagal menyimpan transaksi. Silakan coba lagi."
          );
        }
      } catch {
        setFormError("Gagal menyimpan transaksi. Silakan coba lagi.");
      }
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (pending) return;

    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setFormError(null);

    await doSubmit();
  }

  function handleCancel() {
    if (pending) return;
    resetForm();
    onCloseRef.current?.();
  }

  function selectCustomer(customer) {
    setSelectedCustomer(customer);
    setCustomerQuery(customer.name);
    setShowDropdown(false);
    setShowNewCustomerForm(false);
    setErrors((prev) => ({ ...prev, customer: undefined }));
  }

  function handleShowNewCustomer() {
    setShowNewCustomerForm(true);
    setSelectedCustomer(null);
    setCustomerQuery("");
    setShowDropdown(false);
    setErrors((prev) => ({ ...prev, customer: undefined }));
  }

  function handleClearCustomer() {
    setSelectedCustomer(null);
    setCustomerQuery("");
    setShowNewCustomerForm(false);
    setNewName("");
    setNewPhone("");
  }

  const selectedCustomerInfo = selectedCustomer
    ? customers.find((c) => c.id === selectedCustomer.id)
    : null;

  const remainingCredit = selectedCustomerInfo
    ? Math.max(
        0,
        selectedCustomerInfo.creditLimit - selectedCustomerInfo.activeDebt
      )
    : null;

  if (!mounted || !open) return null;

  const amountPreview = formatIDR(Number(amountDigits || 0));
  const customerErrorId = `${baseId}-customer-error`;
  const newNameErrorId = `${baseId}-newname-error`;
  const newPhoneErrorId = `${baseId}-newphone-error`;
  const amountPreviewId = `${baseId}-amount-preview`;
  const amountErrorId = `${baseId}-amount-error`;
  const dueDateErrorId = `${baseId}-duedate-error`;

  return createPortal(
    <>
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
          data-testid="new-transaction-dialog"
          className="w-full max-w-lg glass-card rounded-2xl border border-white/40 dark:border-white/10 shadow-xl p-5 sm:p-6 animate-fadeIn bg-white/95 dark:bg-[#1a1625]/95 max-h-[90vh] overflow-y-auto"
        >
          <h2
            id={titleId}
            className="text-base font-bold text-gray-900 dark:text-white"
          >
            Transaksi kasbon baru
          </h2>
          <p
            id={descriptionId}
            className="mt-2 text-sm text-gray-600 dark:text-gray-300"
          >
            Pilih pelanggan, masukkan nominal, dan tentukan tanggal jatuh
            tempo.
          </p>

          <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
            {/* Customer selector */}
            <div>
              <label className={authLabelClass}>Pelanggan</label>
              {selectedCustomer ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-10 px-3 rounded-lg border border-gray-200 dark:border-violet-500/20 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white flex items-center">
                    <User className="w-4 h-4 mr-2 text-gray-400 shrink-0" />
                    <span className="truncate">{selectedCustomer.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearCustomer}
                    disabled={pending}
                    className="shrink-0 p-2 rounded-lg text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
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
                    type="text"
                    value={customerQuery}
                    onChange={(event) => {
                      setCustomerQuery(event.target.value);
                      setShowDropdown(true);
                      setShowNewCustomerForm(false);
                    }}
                    onFocus={() => {
                      if (!selectedCustomer) setShowDropdown(true);
                    }}
                    placeholder="Cari nama pelanggan…"
                    aria-invalid={errors.customer ? "true" : undefined}
                    aria-describedby={
                      errors.customer ? customerErrorId : undefined
                    }
                    className={`${authInputClass} pr-9`}
                  />
                  {customerQuery && !showNewCustomerForm ? (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerQuery("");
                        setShowDropdown(true);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  ) : null}

                  {showDropdown && !showNewCustomerForm ? (
                    <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#241f33]/95 backdrop-blur-xl shadow-lg">
                      {filteredCustomers.length > 0 ? (
                        filteredCustomers.map((customer) => (
                          <button
                            key={customer.id}
                            type="button"
                            onClick={() => selectCustomer(customer)}
                            className="w-full text-left px-3 py-2.5 text-sm text-gray-900 dark:text-white hover:bg-violet-50 dark:hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-inset"
                          >
                            <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <span className="truncate font-medium">
                              {customer.name}
                            </span>
                            <span className="ml-auto text-[11px] text-gray-400 dark:text-gray-500 shrink-0">
                              {customer.phoneNumber}
                            </span>
                          </button>
                        ))
                      ) : null}

                      <button
                        type="button"
                        onClick={handleShowNewCustomer}
                        className="w-full text-left px-3 py-2.5 text-sm text-violet-600 dark:text-violet-400 font-semibold hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors cursor-pointer flex items-center gap-2 border-t border-gray-100 dark:border-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-inset"
                      >
                        <UserPlus className="w-3.5 h-3.5 shrink-0" />
                        Pelanggan baru?
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
              <FieldError id={customerErrorId} message={errors.customer} />
            </div>

            {/* Inline new customer form */}
            {showNewCustomerForm && !selectedCustomer ? (
              <div className="rounded-lg border border-violet-200 dark:border-violet-500/25 bg-violet-50/50 dark:bg-violet-500/5 p-3 space-y-3">
                <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">
                  Tambah pelanggan baru
                </p>
                <div>
                  <label
                    htmlFor={`${baseId}-newname`}
                    className={authLabelClass}
                  >
                    Nama pelanggan
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                      id={`${baseId}-newname`}
                      type="text"
                      required
                      value={newName}
                      onChange={(event) => {
                        setNewName(event.target.value);
                        if (errors.newName) {
                          setErrors((prev) => ({
                            ...prev,
                            newName: undefined,
                          }));
                        }
                      }}
                      aria-invalid={errors.newName ? "true" : undefined}
                      aria-describedby={
                        errors.newName ? newNameErrorId : undefined
                      }
                      placeholder="Nama lengkap pelanggan"
                      className={authInputClass}
                    />
                  </div>
                  <FieldError id={newNameErrorId} message={errors.newName} />
                </div>
                <div>
                  <label
                    htmlFor={`${baseId}-newphone`}
                    className={authLabelClass}
                  >
                    Nomor HP
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                      id={`${baseId}-newphone`}
                      type="tel"
                      required
                      value={newPhone}
                      onChange={(event) => {
                        setNewPhone(event.target.value);
                        if (errors.newPhone) {
                          setErrors((prev) => ({
                            ...prev,
                            newPhone: undefined,
                          }));
                        }
                      }}
                      aria-invalid={errors.newPhone ? "true" : undefined}
                      aria-describedby={
                        errors.newPhone ? newPhoneErrorId : undefined
                      }
                      placeholder="0812xxxxxxx"
                      className={authInputClass}
                    />
                  </div>
                  <FieldError id={newPhoneErrorId} message={errors.newPhone} />
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Limit kredit default: {formatIDR(100000)}
                </p>
              </div>
            ) : null}

            {/* Customer info box */}
            {selectedCustomerInfo && !showNewCustomerForm ? (
              <div className="rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <RiskScoreBadge
                    value={selectedCustomerInfo.riskScore}
                    trustStatus={selectedCustomerInfo.trustStatus}
                  />
                  <TrustStatusBadge value={selectedCustomerInfo.trustStatus} />
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                  <span className="text-gray-500 dark:text-gray-400">
                    Limit: {formatIDR(selectedCustomerInfo.creditLimit)}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">
                    Utang aktif: {formatIDR(selectedCustomerInfo.activeDebt)}
                  </span>
                  <span className="font-semibold text-gray-700 dark:text-gray-200">
                    Sisa limit: {formatIDR(remainingCredit)}
                  </span>
                </div>
              </div>
            ) : null}

            {/* Amount */}
            <div>
              <label htmlFor={`${baseId}-amount`} className={authLabelClass}>
                Nominal
              </label>
              <div className="relative">
                <Wallet className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  ref={amountRef}
                  id={`${baseId}-amount`}
                  type="text"
                  inputMode="numeric"
                  value={
                    amountDigits
                      ? new Intl.NumberFormat("id-ID").format(
                          Number(amountDigits)
                        )
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

            {/* Due date */}
            <div>
              <label
                htmlFor={`${baseId}-duedate`}
                className={authLabelClass}
              >
                Tanggal jatuh tempo
              </label>
              <div className="relative">
                <CalendarDays className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  ref={dueDateRef}
                  id={`${baseId}-duedate`}
                  type="date"
                  min={todayLocal()}
                  required
                  value={dueDate}
                  onChange={(event) => {
                    setDueDate(event.target.value);
                    if (errors.dueDate) {
                      setErrors((prev) => ({ ...prev, dueDate: undefined }));
                    }
                  }}
                  aria-invalid={errors.dueDate ? "true" : undefined}
                  aria-describedby={
                    errors.dueDate ? dueDateErrorId : undefined
                  }
                  className={`${authInputClass} pr-3`}
                />
              </div>
              <FieldError id={dueDateErrorId} message={errors.dueDate} />
            </div>

            {/* Note */}
            <div>
              <label
                htmlFor={`${baseId}-note`}
                className={authLabelClass}
              >
                Catatan <span className="font-normal text-gray-400 dark:text-gray-500">(opsional)</span>
              </label>
              <div className="relative">
                <FileText className="w-4 h-4 absolute left-3 top-3 text-gray-400 pointer-events-none" />
                <textarea
                  id={`${baseId}-note`}
                  rows={2}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Contoh: Beli beras 50kg…"
                  className={`${authInputClass} pl-9 resize-none py-2.5`}
                />
              </div>
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
                {pending ? "Menyimpan…" : "Simpan transaksi"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>,
    document.body
  );
}
