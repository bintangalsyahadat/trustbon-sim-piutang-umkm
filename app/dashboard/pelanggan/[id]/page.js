import { notFound } from "next/navigation";
import { ArrowLeft, Banknote, Receipt, Scale, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/session-guards";
import { getActiveDebtByCustomer } from "@/lib/customer-debt";
import { formatIDR } from "@/lib/format";
import { GuardedLink } from "@/components/GuardedLink";
import { StatCard } from "@/components/dashboard/StatCard";
import {
  PaymentStatusBadge,
  RiskScoreBadge,
  TrustStatusBadge,
} from "@/components/dashboard/StatusBadge";

export const metadata = { title: "Detail Pelanggan — TrustBon" };

const sectionCardClass =
  "glass-card rounded-2xl border border-white/40 dark:border-white/10 shadow-md p-5 sm:p-6";

const backLinkClass =
  "inline-flex items-center gap-1.5 px-2 py-1 -ml-2 rounded-md text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500";

const TABLE_HEAD_CELL_CLASSES =
  "px-5 sm:px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400";
const TABLE_BODY_CELL_CLASSES = "px-5 sm:px-6 py-3.5";

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function CustomerDetailPage({ params }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) notFound();

  const { member } = await requireOwner();

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
    },
  });
  if (!customer) notFound();

  const [debts, transactions] = await Promise.all([
    getActiveDebtByCustomer(member.businessId, numericId),
    prisma.transaction.findMany({
      where: { businessId: member.businessId, customerId: numericId },
      orderBy: { transactionDate: "desc" },
      select: {
        id: true,
        amount: true,
        transactionDate: true,
        paymentStatus: true,
        status: true,
      },
    }),
  ]);

  const limit = Number(customer.creditLimit);
  const activeDebt = debts.get(numericId) ?? 0;
  const remainingLimit = Math.max(0, limit - activeDebt);

  // Format dates and amounts on the server; pass label strings only.
  const transactionItems = transactions.map((transaction) => ({
    id: transaction.id,
    dateLabel: dateFormatter.format(transaction.transactionDate),
    amountLabel: formatIDR(transaction.amount),
    paymentStatus: transaction.paymentStatus,
  }));

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn">
      <GuardedLink href="/dashboard/pelanggan" className={backLinkClass}>
        <ArrowLeft className="w-3.5 h-3.5" />
        Kembali ke daftar pelanggan
      </GuardedLink>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#181126] dark:text-white">
            {customer.name}
          </h1>
          <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-300">
            {customer.phoneNumber}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RiskScoreBadge value={customer.riskScore} />
          <TrustStatusBadge value={customer.trustStatus} />
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard
          icon={Wallet}
          label="Limit Kredit"
          value={formatIDR(limit)}
          hint="Batas kasbon pelanggan"
        />
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

      <section className={`${sectionCardClass} mt-8`}>
        <div className="pb-4 mb-5 border-b border-gray-200 dark:border-white/10">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">
            Riwayat transaksi
          </h2>
          <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
            Seluruh kasbon dan penyesuaian untuk pelanggan ini.
          </p>
        </div>

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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-gray-200/70 dark:border-white/10 text-left">
                  <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                    Tanggal
                  </th>
                  <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                    Nominal
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
                      <PaymentStatusBadge value={transaction.paymentStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
