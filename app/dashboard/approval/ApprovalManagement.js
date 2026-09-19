"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ClipboardCheck,
  FileText,
  Loader2,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { authInputClass, authLabelClass } from "@/components/AuthUi";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  RiskScoreBadge,
  TrustStatusBadge,
} from "@/components/dashboard/StatusBadge";
import { useToast } from "@/components/Toast";
import { approveTransaction, rejectTransaction } from "@/app/actions/transactions";

const sectionCardClass =
  "glass-card rounded-2xl border border-white/40 dark:border-white/10 shadow-md p-5 sm:p-6";

const primaryButtonClass =
  "px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-xs shadow-md shadow-emerald-500/30 dark:shadow-black/30 transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1a1625]";

const secondaryButtonClass =
  "px-4 py-2.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/10 disabled:opacity-60 disabled:cursor-not-allowed font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1a1625]";

const emptySubscribe = () => () => {};

const idrFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const dangerButtonClass =
  "px-4 py-2.5 rounded-lg bg-rose-500 hover:bg-rose-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-xs shadow-md shadow-rose-500/30 dark:shadow-black/30 transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1a1625]";

export function ApprovalManagement({ transactions }) {
  const router = useRouter();
  const toast = useToast();

  // Hydration-safe mounted flag for portalling the reject dialog to
  // document.body (same pattern as ConfirmDialog).
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  // Search state (client-side filter over the loaded list)
  const [query, setQuery] = useState("");

  // Approve state
  const [approveTx, setApproveTx] = useState(null);
  const [approvePending, startApproveTransition] = useTransition();

  // Reject state
  const [rejectTx, setRejectTx] = useState(null);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectError, setRejectError] = useState(null);
  const [rejectPending, startRejectTransition] = useTransition();

  function doApprove() {
    if (!approveTx) return;
    startApproveTransition(async () => {
      try {
        const res = await approveTransaction({ transactionId: approveTx.id });
        if (res?.ok) {
          toast.success("Transaksi berhasil disetujui.");
          setApproveTx(null);
          router.refresh();
        } else {
          toast(res?.error ?? "Gagal menyetujui transaksi.");
          setApproveTx(null);
        }
      } catch {
        toast("Gagal menyetujui transaksi.");
        setApproveTx(null);
      }
    });
  }

  function openReject(tx) {
    setRejectTx(tx);
    setRejectNote("");
    setRejectError(null);
  }

  function closeReject() {
    setRejectTx(null);
    setRejectNote("");
    setRejectError(null);
  }

  function doReject() {
    if (!rejectTx) return;
    const cleanNote = rejectNote.trim();
    if (!cleanNote) {
      setRejectError("Alasan penolakan wajib diisi.");
      return;
    }
    setRejectError(null);
    startRejectTransition(async () => {
      try {
        const res = await rejectTransaction({
          transactionId: rejectTx.id,
          note: cleanNote,
        });
        if (res?.ok) {
          toast.success("Transaksi berhasil ditolak.");
          closeReject();
          router.refresh();
        } else {
          setRejectError(res?.error ?? "Gagal menolak transaksi.");
        }
      } catch {
        setRejectError("Gagal menolak transaksi.");
      }
    });
  }

  const normalizedQuery = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!normalizedQuery) return transactions;
    return transactions.filter(
      (tx) =>
        (tx.customerName ?? "").toLowerCase().includes(normalizedQuery) ||
        (tx.transactionNumber ?? "").toLowerCase().includes(normalizedQuery)
    );
  }, [transactions, normalizedQuery]);

  const isEmpty = transactions.length === 0;

  return (
    <div>
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#181126] dark:text-white">
          Approval Transaksi
        </h1>
        <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-300">
          Tinjau kasbon yang melebihi limit kredit sebelum disetujui.
        </p>
      </div>

      {/* Search */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="search"
            aria-label="Cari transaksi yang menunggu persetujuan"
            placeholder="Cari nama pelanggan atau nomor transaksi…"
            data-testid="approval-search"
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

      {!isEmpty && (
        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 tabular-nums">
          Menunggu persetujuan:{" "}
          {normalizedQuery
            ? `${filtered.length} dari ${transactions.length} transaksi`
            : `${transactions.length} transaksi`}
        </p>
      )}

      {isEmpty ? (
        <section className={`${sectionCardClass} mt-6`}>
          <div className="rounded-xl border border-dashed border-gray-200 dark:border-white/10 px-4 py-8 text-center">
            <div className="w-11 h-11 rounded-2xl bg-emerald-100 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/25 text-emerald-600 dark:text-emerald-300 flex items-center justify-center mx-auto mb-3">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Tidak ada transaksi yang perlu disetujui
            </h3>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">
              Semua transaksi kasbon sudah ditinjau atau belum ada yang melebihi
              limit kredit.
            </p>
          </div>
        </section>
      ) : filtered.length === 0 ? (
        <section className={`${sectionCardClass} mt-6`}>
          <div className="rounded-xl border border-dashed border-gray-200 dark:border-white/10 px-4 py-8 text-center">
            <div className="w-11 h-11 rounded-2xl bg-violet-100 dark:bg-violet-500/15 border border-violet-200 dark:border-violet-500/25 text-violet-600 dark:text-violet-300 flex items-center justify-center mx-auto mb-3">
              <Search className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Tidak ada transaksi yang cocok dengan pencarian
            </h3>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">
              Coba kata kunci lain, atau hapus pencarian untuk melihat semua
              transaksi yang menunggu persetujuan.
            </p>
            <button
              type="button"
              onClick={() => setQuery("")}
              className={`${secondaryButtonClass} mt-4 mx-auto`}
            >
              <X className="w-3.5 h-3.5" />
              Hapus pencarian
            </button>
          </div>
        </section>
      ) : (
        <div className="mt-6 space-y-4">
          {filtered.map((tx) => {
            const creditLimitNumber = Number(tx.customerCreditLimit);
            const hasCreditLimit =
              Number.isFinite(creditLimitNumber) && creditLimitNumber >= 0;
            const creditLimitLabel = hasCreditLimit
              ? idrFormatter.format(creditLimitNumber)
              : "—";
            const totalAfterNumber = Number(tx.totalAfter);
            const hasTotalAfter = Number.isFinite(totalAfterNumber);
            const overLimitByNumber = Number(tx.overLimitBy);
            const isOverLimit =
              Number.isFinite(overLimitByNumber) &&
              overLimitByNumber > 0 &&
              Boolean(tx.overLimitByLabel);
            const usagePercent =
              hasCreditLimit && creditLimitNumber > 0 && hasTotalAfter
                ? Math.min(
                    100,
                    Math.round((totalAfterNumber / creditLimitNumber) * 100)
                  )
                : null;
            const creatorName =
              typeof tx.creatorName === "string" && tx.creatorName.trim()
                ? tx.creatorName
                : null;
            const creatorRoleLabel =
              tx.creatorRole === "owner"
                ? "Pemilik"
                : tx.creatorRole === "cashier"
                  ? "Kasir"
                  : null;

            return (
            <section
              key={tx.id}
              className={`${sectionCardClass}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-bold text-gray-900 dark:text-white">
                      {tx.customerName}
                    </h2>
                  <p className="mt-0.5 text-[11px] font-medium tabular-nums text-gray-400 dark:text-gray-500">
                    {tx.transactionNumber}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                    <UserRound className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 truncate">
                      {creatorName ? (
                        <>
                          Diinput oleh{" "}
                          <span className="font-semibold text-gray-700 dark:text-gray-200">
                            {creatorName}
                            {creatorRoleLabel ? ` · ${creatorRoleLabel}` : ""}
                          </span>
                        </>
                      ) : (
                        <span className="font-medium text-gray-400 dark:text-gray-500">
                          Penginput tidak diketahui
                        </span>
                      )}
                    </span>
                  </p>

                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block">
                        Nominal
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-white text-sm">
                        {tx.amountLabel}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block">
                        Jatuh Tempo
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {tx.dueDateLabel}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block">
                        Tanggal Transaksi
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {tx.transactionDateLabel}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-3">
                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                      <div className="min-w-0">
                        <span className="text-gray-500 dark:text-gray-400 block">
                          Limit Kredit
                        </span>
                        <span className="font-semibold tabular-nums text-gray-900 dark:text-white">
                          {creditLimitLabel}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-gray-500 dark:text-gray-400 block">
                          Utang Aktif
                        </span>
                        <span className="font-semibold tabular-nums text-gray-900 dark:text-white">
                          {tx.activeDebtLabel ?? "—"}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-gray-500 dark:text-gray-400 block leading-tight">
                          Total setelah disetujui
                        </span>
                        <span
                          className={`font-semibold tabular-nums ${
                            isOverLimit
                              ? "text-rose-600 dark:text-rose-300"
                              : "text-gray-900 dark:text-white"
                          }`}
                        >
                          {tx.totalAfterLabel ?? "—"}
                        </span>
                      </div>
                    </div>
                    {usagePercent !== null ? (
                      <div className="mt-2.5 flex items-center gap-2">
                        <div
                          role="progressbar"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={usagePercent}
                          aria-label={`Pemakaian limit setelah disetujui: ${usagePercent} persen`}
                          className="flex-1 bg-gray-200 dark:bg-white/10 rounded-full h-1.5 overflow-hidden"
                        >
                          <div
                            className={`h-1.5 rounded-full ${
                              isOverLimit ? "bg-rose-500" : "bg-emerald-500"
                            }`}
                            style={{ width: `${usagePercent}%` }}
                          />
                        </div>
                        {isOverLimit ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tabular-nums border bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/25">
                            Melebihi limit {tx.overLimitByLabel}
                          </span>
                        ) : (
                          <span className="text-[10px] tabular-nums text-gray-500 dark:text-gray-400">
                            {usagePercent}% dari limit
                          </span>
                        )}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <RiskScoreBadge
                      value={tx.customerRiskScore}
                      trustStatus={tx.customerTrustStatus}
                    />
                    <TrustStatusBadge value={tx.customerTrustStatus} />
                  </div>
                </div>

                <div className="flex flex-row sm:flex-col gap-2 sm:items-end shrink-0">
                  <button
                    type="button"
                    onClick={() => setApproveTx(tx)}
                    disabled={approvePending || rejectPending}
                    className={`${primaryButtonClass} flex-1 sm:flex-initial`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    Setujui
                  </button>
                  <button
                    type="button"
                    onClick={() => openReject(tx)}
                    disabled={approvePending || rejectPending}
                    className={`${dangerButtonClass} flex-1 sm:flex-initial`}
                  >
                    <X className="w-3.5 h-3.5" />
                    Tolak
                  </button>
                </div>
              </div>
            </section>
            );
          })}
        </div>
      )}

      {/* Approve Confirm Dialog */}
      {approveTx ? (
        <ConfirmDialog
          open={true}
          title="Setujui Transaksi"
          description={`Setujui transaksi kasbon ${approveTx.amountLabel} untuk ${approveTx.customerName}? Transaksi akan langsung aktif sebagai utang terkonfirmasi.`}
          onDismiss={() => { if (!approvePending) setApproveTx(null); }}
          actions={[
            {
              label: approvePending ? "Menyetujui…" : "Ya, Setujui",
              onClick: doApprove,
              loading: approvePending,
            },
            {
              label: "Kembali",
              onClick: () => setApproveTx(null),
              tone: "neutral",
            },
          ]}
        />
      ) : null}

      {/* Reject Dialog — portalled to document.body after hydration so the
          fixed backdrop resolves against the viewport, not a backdrop-filter /
          transformed ancestor. */}
      {rejectTx && mounted
        ? createPortal(
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md glass-card rounded-2xl border border-white/40 dark:border-white/10 shadow-xl p-5 sm:p-6 animate-fadeIn bg-white/95 dark:bg-[#1a1625]/95"
          >
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              Tolak Transaksi
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Tolak transaksi kasbon {rejectTx.amountLabel} untuk{" "}
              {rejectTx.customerName}? Alasan penolakan akan dicatat untuk jejak
              audit.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className={authLabelClass}>Alasan Penolakan</label>
                <div className="relative">
                  <FileText className="w-4 h-4 absolute left-3 top-3 text-gray-400 pointer-events-none" />
                  <textarea
                    rows={3}
                    value={rejectNote}
                    onChange={(e) => {
                      setRejectNote(e.target.value);
                      if (rejectError) setRejectError(null);
                    }}
                    placeholder="Contoh: Transaksi ini sudah tidak diperlukan…"
                    className={`${authInputClass} pl-9 resize-none`}
                  />
                </div>
                {rejectError ? (
                  <p className="mt-1.5 text-[11px] font-medium text-rose-600 dark:text-rose-300">
                    {rejectError}
                  </p>
                ) : null}
              </div>
              <div className="pt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeReject}
                  disabled={rejectPending}
                  className={`${secondaryButtonClass} w-full sm:w-auto`}
                >
                  Kembali
                </button>
                <button
                  type="button"
                  onClick={doReject}
                  disabled={rejectPending}
                  className={`${dangerButtonClass} w-full sm:w-auto`}
                >
                  {rejectPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : null}
                  {rejectPending ? "Menolak…" : "Ya, Tolak"}
                </button>
              </div>
            </div>
          </div>
        </div>,
            document.body
          )
        : null}
    </div>
  );
}
