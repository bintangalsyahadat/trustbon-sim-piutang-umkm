"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Wallet, X } from "lucide-react";
import { authInputClass } from "@/components/AuthUi";
import { Badge } from "@/components/dashboard/StatusBadge";
import { NewPaymentDialog } from "./NewPaymentDialog";

const sectionCardClass =
  "glass-card rounded-2xl border border-white/40 dark:border-white/10 shadow-md p-5 sm:p-6";

const headerPrimaryButtonClass =
  "inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-sm font-semibold shadow-md shadow-violet-500/25 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500";

const secondaryButtonClass =
  "px-4 py-2.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/10 disabled:opacity-60 disabled:cursor-not-allowed font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1a1625]";

const TABLE_HEAD_CELL_CLASSES =
  "px-5 sm:px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400";
const TABLE_BODY_CELL_CLASSES = "px-5 sm:px-6 py-3.5";

// Payment record statuses: emerald for confirmed, rose for cancelled.
const PAYMENT_STATUS_MAP = {
  confirmed: { label: "Terkonfirmasi", tone: "emerald" },
  cancelled: { label: "Dibatalkan", tone: "rose" },
};

/**
 * Payment history list: header + primary CTA, client-side search by customer
 * name, and the recorded-payments table. Owns the NewPaymentDialog open state;
 * a successful save closes the dialog and refreshes the server data.
 */
export function PaymentManagement({ payments, kasbonOptions }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  const normalizedQuery = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!normalizedQuery) return payments;
    return payments.filter((payment) =>
      payment.customerName.toLowerCase().includes(normalizedQuery)
    );
  }, [payments, normalizedQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  // Reset to the first page whenever the search query changes.
  const prevQueryRef = useRef(normalizedQuery);
  useEffect(() => {
    if (prevQueryRef.current !== normalizedQuery) {
      prevQueryRef.current = normalizedQuery;
      setCurrentPage(1);
    }
  }, [normalizedQuery]);

  function handleSaved() {
    setFormOpen(false);
    router.refresh();
  }

  const isEmpty = payments.length === 0;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#181126] dark:text-white">
            Pembayaran
          </h1>
          <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-300">
            Catat pembayaran kasbon pelanggan dan lihat riwayatnya.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className={headerPrimaryButtonClass}
            data-testid="open-payment-dialog"
          >
            <Plus className="w-4.5 h-4.5" />
            Catat Pembayaran
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="search"
            aria-label="Cari pembayaran"
            placeholder="Cari nama pelanggan…"
            data-testid="payment-search"
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
      </div>

      {!isEmpty && filtered.length > 0 ? (
        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 tabular-nums">
          Menampilkan {(safePage - 1) * PAGE_SIZE + 1}–
          {Math.min(safePage * PAGE_SIZE, filtered.length)} dari{" "}
          {filtered.length} pembayaran
        </p>
      ) : null}

      {isEmpty ? (
        <section className={`${sectionCardClass} mt-4`}>
          <div className="rounded-xl border border-dashed border-gray-200 dark:border-white/10 px-4 py-8 text-center">
            <div className="w-11 h-11 rounded-2xl bg-violet-100 dark:bg-violet-500/15 border border-violet-200 dark:border-violet-500/25 text-violet-600 dark:text-violet-300 flex items-center justify-center mx-auto mb-3">
              <Wallet className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Belum ada pembayaran tercatat
            </h3>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">
              Catat pelunasan kasbon pelanggan dengan menekan tombol
              &quot;Catat Pembayaran&quot;.
            </p>
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className={`${secondaryButtonClass} mt-4 mx-auto`}
            >
              <Plus className="w-3.5 h-3.5" />
              Catat Pembayaran
            </button>
          </div>
        </section>
      ) : (
        <section className={`${sectionCardClass} mt-4`}>
          <div className="overflow-x-auto">
            <table
              data-testid="payment-table"
              className="w-full min-w-[640px] text-sm"
            >
              <thead>
                <tr className="border-b border-gray-200/70 dark:border-white/10 text-left">
                  <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                    Pelanggan
                  </th>
                  <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                    Jumlah Dibayar
                  </th>
                  <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                    Tanggal
                  </th>
                  <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 sm:px-6 py-8">
                      <div className="text-center">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                          Tidak ada pembayaran yang cocok dengan pencarian.
                        </p>
                        <button
                          type="button"
                          onClick={() => setQuery("")}
                          className={`${secondaryButtonClass} mt-4 mx-auto`}
                        >
                          Hapus pencarian
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginated.map((payment) => {
                    const statusConfig = PAYMENT_STATUS_MAP[payment.status] ?? {
                      label: payment.status,
                      tone: "neutral",
                    };
                    const isCancelled = payment.status === "cancelled";

                    const rowClass = isCancelled
                      ? "border-b border-gray-100/80 dark:border-white/5 last:border-b-0 opacity-50"
                      : "border-b border-gray-100/80 dark:border-white/5 last:border-b-0 hover:bg-violet-50/60 dark:hover:bg-white/5 transition-colors";

                    return (
                      <tr
                        key={payment.id}
                        data-testid="payment-row"
                        className={rowClass}
                      >
                        <td className={TABLE_BODY_CELL_CLASSES}>
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {payment.customerName}
                          </div>
                          <div className="mt-0.5 text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
                            {payment.transactionNumber}
                          </div>
                        </td>
                        <td
                          className={`${TABLE_BODY_CELL_CLASSES} tabular-nums font-medium text-gray-900 dark:text-white`}
                        >
                          {payment.amountPaidLabel}
                        </td>
                        <td
                          className={`${TABLE_BODY_CELL_CLASSES} tabular-nums text-gray-700 dark:text-gray-300`}
                        >
                          {payment.paymentDateLabel}
                        </td>
                        <td className={TABLE_BODY_CELL_CLASSES}>
                          <Badge tone={statusConfig.tone}>
                            {statusConfig.label}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })
                )}
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
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
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

      {/* Remount on open so the form always starts clean. */}
      <NewPaymentDialog
        key={formOpen ? "payment-open" : "payment-closed"}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
        kasbonOptions={kasbonOptions}
      />
    </div>
  );
}
