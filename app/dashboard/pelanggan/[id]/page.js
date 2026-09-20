import { notFound } from "next/navigation";
import { ArrowLeft, Banknote, Phone, Receipt, Scale } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireActiveMember } from "@/lib/session-guards";
import { getActiveDebtByCustomer } from "@/lib/customer-debt";
import {
  businessPrefix,
  formatIDR,
  formatTransactionNumber,
} from "@/lib/format";
import { describePaymentTiming } from "@/lib/payment-timing";
import { GuardedLink } from "@/components/GuardedLink";
import { SectionHeading } from "@/components/dashboard/SectionHeading";
import { StatCard } from "@/components/dashboard/StatCard";
import {
  Badge,
  PaymentProgressBadge,
  PaymentStatusBadge,
  RiskScoreBadge,
  TrustStatusBadge,
} from "@/components/dashboard/StatusBadge";
import { EditCreditLimitButton } from "./EditCreditLimitDialog";
import { AutoReminderToggle } from "./AutoReminderToggle";

export const metadata = { title: "Detail Pelanggan — TrustBon" };

const sectionCardClass =
  "glass-card rounded-2xl border border-white/40 dark:border-white/10 shadow-md p-5 sm:p-6";

const backLinkClass =
  "inline-flex items-center gap-1.5 px-2 py-1 -ml-2 rounded-md text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500";

const TABLE_HEAD_CELL_CLASSES =
  "px-5 sm:px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400";
const TABLE_BODY_CELL_CLASSES = "px-5 sm:px-6 py-3.5";

const statLabelClass =
  "text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400";
const statValueClass =
  "mt-1 text-xl sm:text-2xl font-extrabold tracking-tight tabular-nums text-[#181126] dark:text-white";
const statHintClass =
  "mt-1.5 text-xs text-gray-600 dark:text-gray-400 leading-relaxed";

// Trust-status hint copy (mirrors the TrustStatusBadge wording).
const TRUST_STATUS_HINT = {
  stable: "Pembayaran konsisten tepat waktu",
  recovering: "Sedang memulihkan kepercayaan",
  at_risk: "Riwayat pembayaran berisiko",
  unrated: "Belum ada riwayat pembayaran lunas",
};

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/**
 * Initials for the profile avatar: first character of up to the first two
 * whitespace-separated words, uppercased, max 2 chars. Never throws on an
 * empty/odd name — falls back to "?".
 */
function getInitials(name) {
  const words = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default async function CustomerDetailPage({ params }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) notFound();

  // Both roles may read this customer (Kasir is read-only; the edit control
  // renders for owners only below).
  const { member } = await requireActiveMember();
  const isOwner = member.role === "owner";

  // IDOR-safe: always scope the lookup to the actor's own business.
  const customer = await prisma.customer.findFirst({
    where: { id: numericId, businessId: member.businessId },
    select: {
      id: true,
      name: true,
      phoneNumber: true,
      creditLimit: true,
      riskScore: true,
      trustStatus: true,
      autoReminder: true,
    },
  });
  if (!customer) notFound();

  const [debts, transactions, scoreHistory] = await Promise.all([
    getActiveDebtByCustomer(member.businessId, numericId),
    prisma.transaction.findMany({
      where: { businessId: member.businessId, customerId: numericId },
      orderBy: { transactionDate: "desc" },
      select: {
        id: true,
        period: true,
        sequenceNumber: true,
        amount: true,
        transactionDate: true,
        dueDate: true,
        paymentStatus: true,
        status: true,
        note: true,
        // Last confirmed payment drives the "Ketepatan" column.
        payments: {
          where: { status: "confirmed" },
          orderBy: { paymentDate: "desc" },
          take: 1,
          select: { paymentDate: true },
        },
      },
    }),
    prisma.scoreHistory.findMany({
      where: { customerId: numericId },
      orderBy: { recordedAt: "asc" },
      select: { recordedAt: true, score: true, trustStatus: true },
    }),
  ]);

  const limit = Number(customer.creditLimit);
  const activeDebt = debts.get(numericId) ?? 0;
  const remainingLimit = Math.max(0, limit - activeDebt);
  const now = new Date();

  // Format dates/amounts on the server; pass label strings only.
  const transactionItems = transactions.map((transaction) => {
    const lastPaymentDate = transaction.payments[0]?.paymentDate ?? null;
    const timing = describePaymentTiming({
      dueDate: transaction.dueDate,
      lastPaymentDate,
      recordStatus: transaction.paymentStatus,
      now,
    });

    return {
      id: transaction.id,
      transactionNumber: formatTransactionNumber(
        transaction.period,
        transaction.sequenceNumber,
        businessPrefix(member.business?.name),
      ),
      dateLabel: dateFormatter.format(transaction.transactionDate),
      amountLabel: formatIDR(transaction.amount),
      progressStatus: transaction.status,
      paymentStatus: transaction.paymentStatus,
      note: transaction.note ?? null,
      timing,
    };
  });

  // Last 30 score points drive the inline SVG trend chart.
  const scorePoints = scoreHistory.slice(-30).map((entry) => ({
    score: entry.score,
    recordedAtLabel: dateFormatter.format(entry.recordedAt),
  }));
  const chart =
    scorePoints.length > 0
      ? {
          count: scorePoints.length,
          scores: scorePoints.map((point) => point.score),
          firstDateLabel: scorePoints[0].recordedAtLabel,
          lastDateLabel: scorePoints[scorePoints.length - 1].recordedAtLabel,
          lastScore: scorePoints[scorePoints.length - 1].score,
          delta:
            scorePoints[scorePoints.length - 1].score - scorePoints[0].score,
        }
      : null;

  const riskScoreLabel =
    customer.trustStatus === "unrated" ? "—" : String(customer.riskScore);
  const trustHint =
    TRUST_STATUS_HINT[customer.trustStatus] ??
    TRUST_STATUS_HINT.unrated;

  // Plain serializable props for the client dialog.
  const dialogCustomer = {
    id: customer.id,
    name: customer.name,
    phoneNumber: customer.phoneNumber,
    creditLimit: limit,
  };

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn space-y-6">
      <GuardedLink href="/dashboard/pelanggan" className={backLinkClass}>
        <ArrowLeft className="w-3.5 h-3.5" />
        Kembali ke daftar pelanggan
      </GuardedLink>

      {/* Profile header */}
      <section className={sectionCardClass}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
          <div
            data-testid="customer-profile-avatar"
            aria-hidden="true"
            className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-xl font-bold text-white shadow-sm sm:h-16 sm:w-16 sm:text-2xl"
          >
            {getInitials(customer.name)}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <h1 className="truncate text-lg font-bold text-gray-900 dark:text-gray-100 sm:text-xl">
              {customer.name}
            </h1>
            <p className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
              <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{customer.phoneNumber}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <RiskScoreBadge
              value={customer.riskScore}
              trustStatus={customer.trustStatus}
            />
            <TrustStatusBadge value={customer.trustStatus} />
            {isOwner ? (
              <EditCreditLimitButton customer={dialogCustomer} />
            ) : null}
          </div>
        </div>
      </section>

      {/* Exactly three headline cards */}
      <section className="grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div
          data-testid="customer-detail-risk-score"
          className={`${sectionCardClass} flex flex-col`}
        >
          <p className={statLabelClass}>Skor Risiko</p>
          <p className={statValueClass}>{riskScoreLabel}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <RiskScoreBadge
              value={customer.riskScore}
              trustStatus={customer.trustStatus}
            />
            <span className={statHintClass}>Skala 0–100</span>
          </div>
        </div>

        <div
          data-testid="customer-detail-trust-status"
          className={`${sectionCardClass} flex flex-col`}
        >
          <p className={statLabelClass}>Status Kepercayaan</p>
          <div className="mt-1.5">
            <TrustStatusBadge value={customer.trustStatus} />
          </div>
          <p className={statHintClass}>{trustHint}</p>
        </div>

        <div
          data-testid="customer-detail-credit-limit"
          className={`${sectionCardClass} flex flex-col`}
        >
          <p className={statLabelClass}>Limit Kredit</p>
          <p className={statValueClass}>{formatIDR(limit)}</p>
          <p className={statHintClass}>Dapat diubah oleh Pemilik</p>
        </div>
      </section>

      {/* Reminder settings (owner-only) */}
      {isOwner ? (
        <section className={sectionCardClass}>
          <AutoReminderToggle
            customerId={customer.id}
            enabled={customer.autoReminder}
          />
        </section>
      ) : null}

      {/* Debt summary (kept from the previous layout, below the headline cards) */}
      <section className="space-y-4">
        <SectionHeading
          title="Ringkasan Utang"
          description="Utang aktif dan sisa limit yang masih tersedia."
        />
        <div className="grid gap-4 sm:gap-5 sm:grid-cols-2">
          <StatCard
            icon={Banknote}
            label="Utang Aktif"
            value={formatIDR(activeDebt)}
            hint="Kasbon terkonfirmasi yang belum lunas"
          />
          <StatCard
            icon={Scale}
            label="Sisa Limit"
            value={formatIDR(remainingLimit)}
            hint="Limit yang masih bisa dipakai"
          />
        </div>
      </section>

      {/* Score history */}
      <section className="space-y-4">
        <SectionHeading
          title="Riwayat Skor"
          description="Tren skor risiko dari waktu ke waktu (skala 0–100)."
        />
        {chart === null ? (
          <div
            data-testid="score-history-empty"
            className="rounded-xl border border-dashed border-gray-200 dark:border-white/10 px-4 py-8 text-center"
          >
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Belum ada riwayat skor untuk pelanggan ini.
            </p>
          </div>
        ) : (
          <div className={sectionCardClass}>
            <svg
              data-testid="score-history-chart"
              role="img"
              aria-label={`Tren skor risiko: ${chart.scores.join(" → ")} (${chart.count} catatan)`}
              viewBox="0 0 100 40"
              preserveAspectRatio="none"
              className="h-32 w-full"
            >
              {chart.scores.map((score, index) => {
                const height = (score / 100) * 40;
                const y = 40 - height;
                const slot = 100 / chart.count;
                const x = index * slot + 0.15 * slot;
                const width = 0.7 * slot;
                const fill =
                  score >= 80 ? "#10b981" : score >= 50 ? "#f59e0b" : "#f43f5e";
                return (
                  <rect
                    key={index}
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    rx="0.6"
                    fill={fill}
                  />
                );
              })}
              <line
                x1="0"
                y1="39.6"
                x2="100"
                y2="39.6"
                stroke="currentColor"
                strokeWidth="0.2"
                className="text-gray-300 dark:text-white/15"
              />
            </svg>
            <div className="mt-3 flex justify-between text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <span>{chart.firstDateLabel}</span>
              <span>{chart.lastDateLabel}</span>
            </div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {chart.count === 1
                ? `Skor terbaru ${chart.lastScore}`
                : `Skor terbaru ${chart.lastScore} · perubahan ${
                    chart.delta >= 0 ? "+" : ""
                  }${chart.delta} poin sejak ${chart.firstDateLabel}`}
            </p>
          </div>
        )}
      </section>

      {/* Transaction history */}
      <section className="space-y-4">
        <SectionHeading
          title="Riwayat Transaksi"
          description="Seluruh kasbon untuk pelanggan ini."
        />

        {transactionItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 dark:border-white/10 px-4 py-8 text-center">
            <div className="w-11 h-11 rounded-2xl bg-violet-100 dark:bg-violet-500/15 border border-violet-200 dark:border-violet-500/25 text-violet-600 dark:text-violet-300 flex items-center justify-center mx-auto mb-3">
              <Receipt className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Belum ada transaksi
            </h3>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">
              Belum ada transaksi untuk pelanggan ini.
            </p>
          </div>
        ) : (
          <div className="glass-card rounded-2xl border border-white/40 dark:border-white/10 shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-gray-200/70 dark:border-white/10 text-left">
                    <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                      No.
                    </th>
                    <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                      Tanggal
                    </th>
                    <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                      Nominal
                    </th>
                    <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                      Progres Pelunasan
                    </th>
                    <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                      Ketepatan
                    </th>
                    <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                      Catatan
                    </th>
                    <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transactionItems.map((transaction) => (
                    <tr
                      key={transaction.id}
                      className="border-b border-gray-100/80 dark:border-white/5 last:border-b-0 hover:bg-violet-50/60 dark:hover:bg-white/5 transition-colors"
                    >
                      <td
                        className={`${TABLE_BODY_CELL_CLASSES} tabular-nums text-xs text-gray-500 dark:text-gray-400`}
                      >
                        {transaction.transactionNumber}
                      </td>
                      <td
                        className={`${TABLE_BODY_CELL_CLASSES} tabular-nums text-gray-700 dark:text-gray-300`}
                      >
                        {transaction.dateLabel}
                      </td>
                      <td
                        className={`${TABLE_BODY_CELL_CLASSES} tabular-nums text-gray-700 dark:text-gray-300`}
                      >
                        {transaction.amountLabel}
                      </td>
                      <td className={TABLE_BODY_CELL_CLASSES}>
                        <PaymentProgressBadge value={transaction.progressStatus} />
                      </td>
                      <td
                        data-testid="transaction-timing"
                        className={TABLE_BODY_CELL_CLASSES}
                      >
                        <Badge tone={transaction.timing.tone}>
                          {transaction.timing.label}
                        </Badge>
                      </td>
                      <td className={`${TABLE_BODY_CELL_CLASSES} max-w-[150px]`}>
                        <p
                          className="text-xs text-gray-600 dark:text-gray-400 truncate"
                          title={transaction.note || ""}
                        >
                          {transaction.note || (
                            <span className="text-gray-400 dark:text-gray-500">
                              —
                            </span>
                          )}
                        </p>
                      </td>
                      <td className={TABLE_BODY_CELL_CLASSES}>
                        <PaymentStatusBadge value={transaction.paymentStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
