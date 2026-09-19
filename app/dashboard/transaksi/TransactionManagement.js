"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  FileText,
  Filter,
  Loader2,
  Pencil,
  Plus,
  Receipt,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { authInputClass, authLabelClass } from "@/components/AuthUi";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  PaymentStatusBadge,
  PaymentProgressBadge,
} from "@/components/dashboard/StatusBadge";
import { useToast } from "@/components/Toast";
import { formatIDR } from "@/lib/format";
import {
  confirmTransaction,
  deleteTransaction,
  cancelTransaction,
  updateTransaction,
} from "@/app/actions/transactions";
import { NewTransactionDialog } from "./NewTransactionDialog";


const sectionCardClass =
  "glass-card rounded-2xl border border-white/40 dark:border-white/10 shadow-md p-5 sm:p-6";

const headerPrimaryButtonClass =
  "inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-sm font-semibold shadow-md shadow-violet-500/25 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500";

const headerSecondaryButtonClass =
  "inline-flex items-center gap-2 h-11 px-5 rounded-xl border border-violet-300 dark:border-violet-500/30 text-violet-700 dark:text-violet-300 text-sm font-semibold hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500";

const secondaryButtonClass =
  "px-4 py-2.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/10 disabled:opacity-60 disabled:cursor-not-allowed font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1a1625]";

const primaryButtonClass =
  "px-4 py-2.5 rounded-lg bg-violet-500 hover:bg-violet-600 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-violet-500 text-white font-semibold text-xs shadow-md shadow-violet-500/30 dark:shadow-black/30 transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1a1625]";

const TABLE_HEAD_CELL_CLASSES =
  "px-5 sm:px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400";
const TABLE_BODY_CELL_CLASSES = "px-5 sm:px-6 py-3.5";

const filterSelectClass =
  "h-10 pl-9 pr-8 rounded-xl border border-gray-200 dark:border-violet-500/20 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all appearance-none cursor-pointer shadow-sm dark:shadow-white/5";

const PAYMENT_STATUS_OPTIONS = [
  { value: "", label: "Semua Status" },
  { value: "draft", label: "Draft" },
  { value: "need_approval", label: "Menunggu Persetujuan" },
  { value: "confirmed", label: "Terkonfirmasi" },
  { value: "cancelled", label: "Dibatalkan" },
];

const PAYMENT_PROGRESS_OPTIONS = [
  { value: "", label: "Semua Progres" },
  { value: "unpaid", label: "Belum Dibayar" },
  { value: "partial", label: "Sebagian" },
  { value: "paid", label: "Lunas" },
];

function ActionButton({ onClick, disabled, loading, icon: Icon, label, tone = "default" }) {
  const base =
    tone === "danger"
      ? "text-rose-500 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10"
      : tone === "success"
        ? "text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
        : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      title={label}
      className={`p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${base}`}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Icon className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

export function TransactionManagement({
  transactions,
  customers,
  userRole = "cashier",
}) {
  const router = useRouter();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [progressFilter, setProgressFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);


  // Edit dialog state
  const [editTx, setEditTx] = useState(null);
  const [editAmount, setEditAmount] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editError, setEditError] = useState(null);
  const [editPending, startEditTransition] = useTransition();

  // Confirm dialog state
  const [confirmTx, setConfirmTx] = useState(null);
  const [confirmPending, startConfirmTransition] = useTransition();

  // Cancel dialog state
  const [cancelTx, setCancelTx] = useState(null);
  const [cancelNote, setCancelNote] = useState("");
  const [cancelError, setCancelError] = useState(null);
  const [cancelPending, startCancelTransition] = useTransition();

  // Delete dialog state
  const [deleteTx, setDeleteTx] = useState(null);
  const [deletePending, startDeleteTransition] = useTransition();
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  const isOwner = userRole === "owner";

  const normalizedQuery = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    let result = transactions;
    if (normalizedQuery) {
      result = result.filter((tx) =>
        tx.customerName.toLowerCase().includes(normalizedQuery) ||
        tx.transactionNumber.toLowerCase().includes(normalizedQuery)
      );
    }
    if (statusFilter) {
      result = result.filter((tx) => tx.paymentStatus === statusFilter);
    }
    if (progressFilter) {
      result = result.filter((tx) => tx.status === progressFilter);
    }
    return result;
  }, [transactions, normalizedQuery, statusFilter, progressFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset page when filters change
  const filterKey = `${normalizedQuery}|${statusFilter}|${progressFilter}`;
  const prevFilterKeyRef = useRef(filterKey);
  useEffect(() => {
    if (prevFilterKeyRef.current !== filterKey) {
      prevFilterKeyRef.current = filterKey;
      setCurrentPage(1);
    }
  }, [filterKey]);

  function handleCreated() {
    router.refresh();
  }

  // ─── Edit handlers ───────────────────────────────────────
  function openEdit(tx) {
    setEditTx(tx);
    setEditAmount(String(tx.amount));
    setEditDueDate(tx.dueDate.slice(0, 10));
    setEditNote(tx.note ?? "");
    setEditError(null);
  }

  function closeEdit() {
    setEditTx(null);
    setEditAmount("");
    setEditDueDate("");
    setEditNote("");
    setEditError(null);
  }

  function doEdit() {
    if (!editTx) return;
    const amount = Number(editAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setEditError("Nominal harus lebih dari 0.");
      return;
    }
    if (!editDueDate) {
      setEditError("Tanggal jatuh tempo wajib diisi.");
      return;
    }
    setEditError(null);
    startEditTransition(async () => {
      try {
          const res = await updateTransaction({
            transactionId: editTx.id,
            amount,
            dueDate: editDueDate,
            note: editNote.trim() || undefined,
        });
        if (res?.ok) {
          toast.success("Transaksi berhasil diperbarui.");
          closeEdit();
          router.refresh();
        } else {
          setEditError(res?.error ?? "Gagal memperbarui transaksi.");
        }
      } catch {
        setEditError("Gagal memperbarui transaksi.");
      }
    });
  }

  // ─── Confirm handler ─────────────────────────────────────
  function openConfirm(tx) {
    setConfirmTx(tx);
  }

  function doConfirm() {
    if (!confirmTx) return;
    startConfirmTransition(async () => {
      try {
        const res = await confirmTransaction({ transactionId: confirmTx.id });
        if (res?.ok) {
          if (res.paymentStatus === "need_approval") {
            toast("Transaksi melebihi limit kredit, menunggu persetujuan Owner.");
          } else {
            toast.success("Transaksi berhasil dikonfirmasi.");
          }
          setConfirmTx(null);
          router.refresh();
        } else {
          toast(res?.error ?? "Gagal mengkonfirmasi transaksi.");
          setConfirmTx(null);
        }
      } catch {
        toast("Gagal mengkonfirmasi transaksi.");
        setConfirmTx(null);
      }
    });
  }

  // ─── Cancel handlers ─────────────────────────────────────
  function openCancel(tx) {
    setCancelTx(tx);
    setCancelNote("");
    setCancelError(null);
  }

  function closeCancel() {
    setCancelTx(null);
    setCancelNote("");
    setCancelError(null);
  }

  function doCancel() {
    if (!cancelTx) return;
    const cleanNote = cancelNote.trim();
    if (!cleanNote) {
      setCancelError("Alasan pembatalan wajib diisi.");
      return;
    }
    setCancelError(null);
    startCancelTransition(async () => {
      try {
        const res = await cancelTransaction({
          transactionId: cancelTx.id,
          note: cleanNote,
        });
        if (res?.ok) {
          toast.success("Transaksi berhasil dibatalkan.");
          closeCancel();
          router.refresh();
        } else {
          setCancelError(res?.error ?? "Gagal membatalkan transaksi.");
        }
      } catch {
        setCancelError("Gagal membatalkan transaksi.");
      }
    });
  }

  // ─── Delete handlers ─────────────────────────────────────
  function openDelete(tx) {
    setDeleteTx(tx);
  }

  function doDelete() {
    if (!deleteTx) return;
    startDeleteTransition(async () => {
      try {
        const res = await deleteTransaction({ transactionId: deleteTx.id });
        if (res?.ok) {
          toast.success("Transaksi berhasil dihapus.");
          setDeleteTx(null);
          router.refresh();
        } else {
          toast(res?.error ?? "Gagal menghapus transaksi.");
          setDeleteTx(null);
        }
      } catch {
        toast("Gagal menghapus transaksi.");
        setDeleteTx(null);
      }
    });
  }

  const isEmpty = transactions.length === 0;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#181126] dark:text-white">
            Transaksi
          </h1>
          <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-300">
            Catat kasbon pelanggan dan pantau status pembayaran.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className={headerPrimaryButtonClass}
          >
            <Plus className="w-4.5 h-4.5" />
            Transaksi Baru
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="search"
            aria-label="Cari transaksi"
            placeholder="Cari nama atau nomor transaksi…"
            data-testid="transaction-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={`${authInputClass} pr-9`}
          />
          {query ? (
            <button
              type="button"
              aria-label="Hapus pencarian"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
        </div>

        <div className="relative">
          <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
          <select
            aria-label="Filter status konfirmasi"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className={filterSelectClass}
          >
            {PAYMENT_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
        </div>

        <div className="relative">
          <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
          <select
            aria-label="Filter progres pelunasan"
            value={progressFilter}
            onChange={(event) => setProgressFilter(event.target.value)}
            className={filterSelectClass}
          >
            {PAYMENT_PROGRESS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
        </div>
      </div>

      {!isEmpty ? (
        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 tabular-nums">
          Menampilkan {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} dari {filtered.length} transaksi
        </p>
      ) : null}

      {isEmpty ? (
        <section className={`${sectionCardClass} mt-4`}>
          <div className="rounded-xl border border-dashed border-gray-200 dark:border-white/10 px-4 py-8 text-center">
            <div className="w-11 h-11 rounded-2xl bg-violet-100 dark:bg-violet-500/15 border border-violet-200 dark:border-violet-500/25 text-violet-600 dark:text-violet-300 flex items-center justify-center mx-auto mb-3">
              <Receipt className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Belum ada transaksi
            </h3>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">
              Mulai catat kasbon pelanggan dengan menekan tombol &quot;Transaksi
              Baru&quot;.
            </p>
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className={`${secondaryButtonClass} mt-4 mx-auto`}
            >
              <Plus className="w-3.5 h-3.5" />
              Transaksi Baru
            </button>
          </div>
        </section>
      ) : filtered.length === 0 ? (
        <section className={`${sectionCardClass} mt-4`}>
          <div className="rounded-xl border border-dashed border-gray-200 dark:border-white/10 px-4 py-8 text-center">
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              Tidak ada transaksi yang cocok dengan filter.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setStatusFilter("");
                setProgressFilter("");
              }}
              className={`${secondaryButtonClass} mt-4 mx-auto`}
            >
              Reset filter
            </button>
          </div>
        </section>
      ) : (
        <section className={`${sectionCardClass} mt-4`}>
          <div className="overflow-x-auto">
            <table
              data-testid="transaction-table"
              className="w-full min-w-[900px] text-sm"
            >
              <thead>
                <tr className="border-b border-gray-200/70 dark:border-white/10 text-left">
                  <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                    No.
                  </th>
                  <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                    Pelanggan
                  </th>
                  <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                    Nominal
                  </th>
                  <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                    Jatuh Tempo
                  </th>
                  <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                    Catatan
                  </th>
                  <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                    Status
                  </th>
                  <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                    Progres
                  </th>
                  <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                    Tanggal
                  </th>
                  <th scope="col" className={`${TABLE_HEAD_CELL_CLASSES} text-right`}>
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((tx) => {
                  const isDraft = tx.paymentStatus === "draft";
                  const isConfirmed = tx.paymentStatus === "confirmed";
                  const isCancelled = tx.paymentStatus === "cancelled";
                  const isNeedApproval = tx.paymentStatus === "need_approval";

                  // Business rule: a transaction with ANY recorded payment
                  // (partial or settled) must not be cancellable.
                  const isCancellable = tx.status === "unpaid";
                  const cancelBlockedTitle =
                    tx.status === "paid"
                      ? "Transaksi yang sudah lunas tidak dapat dibatalkan."
                      : "Transaksi yang sudah memiliki pembayaran tidak dapat dibatalkan.";

                  const rowClass = isCancelled
                    ? "border-b border-gray-100/80 dark:border-white/5 last:border-b-0 opacity-50"
                    : "group border-b border-gray-100/80 dark:border-white/5 last:border-b-0 hover:bg-violet-50/60 dark:hover:bg-white/5 transition-colors";

                  return (
                    <tr key={tx.id} data-testid="transaction-row" className={rowClass}>
                      <td className={`${TABLE_BODY_CELL_CLASSES} tabular-nums text-gray-500 dark:text-gray-400 text-xs`}>
                        {tx.transactionNumber}
                      </td>
                      <td className={TABLE_BODY_CELL_CLASSES}>
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {tx.customerName}
                        </div>
                      </td>
                      <td
                        className={`${TABLE_BODY_CELL_CLASSES} tabular-nums font-medium text-gray-900 dark:text-white`}
                      >
                        {tx.amountLabel}
                      </td>
                      <td
                        className={`${TABLE_BODY_CELL_CLASSES} tabular-nums text-gray-700 dark:text-gray-300`}
                      >
                        {tx.dueDateLabel}
                      </td>
                      <td className={`${TABLE_BODY_CELL_CLASSES} max-w-[150px]`}>                        <p className="text-xs text-gray-600 dark:text-gray-400 truncate" title={tx.note || ""}>                          {tx.note || <span className="text-gray-400 dark:text-gray-500">—</span>}                        </p>                      </td>
                      <td className={TABLE_BODY_CELL_CLASSES}>
                        <PaymentStatusBadge value={tx.paymentStatus} />
                      </td>
                      <td className={TABLE_BODY_CELL_CLASSES}>
                        {isConfirmed || isCancelled ? (
                          <PaymentProgressBadge value={tx.status} />
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                        )}
                      </td>
                      <td
                        className={`${TABLE_BODY_CELL_CLASSES} tabular-nums text-gray-500 dark:text-gray-400`}
                      >
                        {tx.transactionDateLabel}
                      </td>
                      <td className={`${TABLE_BODY_CELL_CLASSES} text-right`}>
                        <div className="flex items-center justify-end gap-0.5">
                          {/* Draft: Edit + Delete + Confirm */}
                          {isDraft ? (
                            <>
                              <ActionButton
                                icon={Pencil}
                                label="Edit"
                                onClick={() => openEdit(tx)}
                              />
                              <ActionButton
                                icon={Trash2}
                                label="Hapus"
                                onClick={() => openDelete(tx)}
                                tone="danger"
                              />
                              <button
                                type="button"
                                onClick={() => openConfirm(tx)}
                                className="ml-1.5 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-semibold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                              >
                                <Check className="w-3 h-3" />
                                Confirm
                              </button>
                            </>
                          ) : null}

                          {/* Confirmed: Cancel (owner only). Rows that already
                              have payments keep a disabled affordance with an
                              explanatory tooltip so the rule stays legible. */}
                          {isConfirmed && isOwner ? (
                            isCancellable ? (
                              <ActionButton
                                icon={X}
                                label="Batalkan"
                                onClick={() => openCancel(tx)}
                                tone="danger"
                              />
                            ) : (
                              <ActionButton
                                icon={X}
                                label={cancelBlockedTitle}
                                disabled
                              />
                            )
                          ) : null}

                          {/* Need approval: note indicator */}
                          {isNeedApproval && tx.note ? (
                            <span className="text-[11px] text-gray-400 dark:text-gray-500 italic">
                              Menunggu…
                            </span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

          {/* Pagination */}
          {filtered.length > PAGE_SIZE ? (
            <div className="flex items-center justify-between px-5 sm:px-6 py-3 border-t border-gray-100/80 dark:border-white/5">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Halaman {safePage} dari {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  Sebelumnya
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  Selanjutnya
                </button>
              </div>
            </div>
          ) : null}
          </div>

        </section>
      )}

      {/* ─── Dialogs ─────────────────────────────────────────── */}
      <NewTransactionDialog
        key={formOpen ? "new-tx-open" : "new-tx-closed"}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onCreated={handleCreated}
        customers={customers}
        userRole={userRole}
      />


      {/* Edit Dialog */}
      {editTx ?
        createPortal(
          <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-md glass-card rounded-2xl border border-white/40 dark:border-white/10 shadow-xl p-5 sm:p-6 animate-fadeIn bg-white/95 dark:bg-[#1a1625]/95"
            >
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Edit Transaksi Draft
              </h2>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                Ubah nominal atau tanggal jatuh tempo untuk transaksi draft ini.
              </p>

              <div className="mt-5 space-y-4">
                <div>
                  <label className={authLabelClass}>Nominal</label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={
                        editAmount
                          ? new Intl.NumberFormat("id-ID").format(Number(editAmount))
                          : ""
                      }
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                        setEditAmount(digits);
                        if (editError) setEditError(null);
                      }}
                      placeholder="0"
                      className={`${authInputClass} !pl-3`}
                    />
                  </div>
                </div>
                <div>
                  <label className={authLabelClass}>Tanggal jatuh tempo</label>
                  <input
                    type="date"
                    value={editDueDate}
                    onChange={(e) => {
                      setEditDueDate(e.target.value);
                      if (editError) setEditError(null);
                    }}
                    className={`${authInputClass} !pl-3 pr-3`}
                  />
                </div>
                <div>
                  <label className={authLabelClass}>Catatan <span className="font-normal text-gray-400 dark:text-gray-500">(opsional)</span></label>
                  <div className="relative">
                    <FileText className="w-4 h-4 absolute left-3 top-3 text-gray-400 pointer-events-none" />
                    <textarea
                      rows={2}
                      value={editNote}
                      onChange={(e) => {
                        setEditNote(e.target.value);
                        if (editError) setEditError(null);
                      }}
                      placeholder="Contoh: Beli beras 50kg…"
                      className={`${authInputClass} pl-9 resize-none py-2.5`}
                    />
                  </div>
                </div>
                {editError ? (
                  <p className="text-[11px] font-medium text-rose-600 dark:text-rose-300">
                    {editError}
                  </p>
                ) : null}
                <div className="pt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeEdit}
                    disabled={editPending}
                    className={`${secondaryButtonClass} w-full sm:w-auto`}
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={doEdit}
                    disabled={editPending}
                    className={`${primaryButtonClass} w-full sm:w-auto`}
                  >
                    {editPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    {editPending ? "Menyimpan…" : "Simpan"}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      : null}

      {/* Confirm Dialog */}
      {confirmTx ? (
        <ConfirmDialog
          open={true}
          title="Konfirmasi Transaksi"
          description={`Konfirmasi transaksi kasbon ${formatIDR(confirmTx.amount)} untuk ${confirmTx.customerName}? Sistem akan mengecek limit kredit pelanggan.`}
          onDismiss={() => { if (!confirmPending) setConfirmTx(null); }}
          actions={[
            {
              label: confirmPending ? "Mengkonfirmasi…" : "Ya, Konfirmasi",
              onClick: doConfirm,
              loading: confirmPending,
            },
            {
              label: "Kembali",
              onClick: () => setConfirmTx(null),
              tone: "neutral",
            },
          ]}
        />
      ) : null}

      {/* Cancel Dialog */}
      {cancelTx ?
        createPortal(
          <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md glass-card rounded-2xl border border-white/40 dark:border-white/10 shadow-xl p-5 sm:p-6 animate-fadeIn bg-white/95 dark:bg-[#1a1625]/95"
          >
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              Batalkan Transaksi
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Batalkan transaksi {formatIDR(cancelTx.amount)} untuk {cancelTx.customerName}?
              Alasan pembatalan akan dicatat untuk jejak audit.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className={authLabelClass}>Alasan Pembatalan</label>
                <div className="relative">
                  <FileText className="w-4 h-4 absolute left-3 top-3 text-gray-400 pointer-events-none" />
                  <textarea
                    rows={3}
                    value={cancelNote}
                    onChange={(e) => {
                      setCancelNote(e.target.value);
                      if (cancelError) setCancelError(null);
                    }}
                    placeholder="Contoh: Transaksi dibuat karena kesalahan input…"
                    className={`${authInputClass} pl-9 resize-none`}
                  />
                </div>
                {cancelError ? (
                  <p className="mt-1.5 text-[11px] font-medium text-rose-600 dark:text-rose-300">
                    {cancelError}
                  </p>
                ) : null}
              </div>
              <div className="pt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeCancel}
                  disabled={cancelPending}
                  className={`${secondaryButtonClass} w-full sm:w-auto`}
                >
                  Kembali
                </button>
                <button
                  type="button"
                  onClick={doCancel}
                  disabled={cancelPending}
                  className="px-4 py-2.5 rounded-lg bg-rose-500 hover:bg-rose-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-xs shadow-md shadow-rose-500/30 dark:shadow-black/30 transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1a1625] w-full sm:w-auto"
                >
                  {cancelPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  {cancelPending ? "Membatalkan…" : "Ya, Batalkan"}
                </button>
              </div>
            </div>
          </div>
          </div>,
          document.body
        )
      : null}

      {/* Delete Confirmation Dialog */}
      {deleteTx ? (
        <ConfirmDialog
          open={true}
          title="Hapus Transaksi Draft"
          description={`Hapus transaksi draft ${formatIDR(deleteTx.amount)} untuk ${deleteTx.customerName}? Tindakan ini tidak dapat dibatalkan.`}
          onDismiss={() => { if (!deletePending) setDeleteTx(null); }}
          actions={[
            {
              label: deletePending ? "Menghapus…" : "Ya, Hapus",
              onClick: doDelete,
              tone: "danger",
              loading: deletePending,
            },
            {
              label: "Kembali",
              onClick: () => setDeleteTx(null),
              tone: "neutral",
            },
          ]}
        />
      ) : null}
    </div>
  );
}
