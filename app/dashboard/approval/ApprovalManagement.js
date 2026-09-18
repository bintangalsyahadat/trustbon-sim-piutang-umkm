"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Check,
  ClipboardCheck,
  FileText,
  Loader2,
  ShieldCheck,
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

const dangerButtonClass =
  "px-4 py-2.5 rounded-lg bg-rose-500 hover:bg-rose-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-xs shadow-md shadow-rose-500/30 dark:shadow-black/30 transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1a1625]";

export function ApprovalManagement({ transactions }) {
  const router = useRouter();
  const toast = useToast();

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

      {!isEmpty && (
        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          Menunggu persetujuan: {transactions.length} transaksi
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
      ) : (
        <div className="mt-6 space-y-4">
          {transactions.map((tx) => (
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

                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
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
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block">
                        Limit Kredit
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {new Intl.NumberFormat("id-ID", {
                          style: "currency",
                          currency: "IDR",
                          maximumFractionDigits: 0,
                        }).format(tx.customerCreditLimit)}
                      </span>
                    </div>
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
          ))}
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

      {/* Reject Dialog */}
      {rejectTx ? (
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
        </div>
      ) : null}
    </div>
  );
}
