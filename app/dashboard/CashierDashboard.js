import { HandCoins, Plus, Receipt, Wallet } from "lucide-react";
import { GuardedLink } from "@/components/GuardedLink";
import { StatCard } from "@/components/dashboard/StatCard";
import { SectionHeading } from "@/components/dashboard/SectionHeading";
import { PaymentStatusBadge } from "@/components/dashboard/StatusBadge";
import { getCashierDashboardData } from "@/lib/dashboard-dummy";
import { formatIDR } from "@/lib/format";

const PRIMARY_BUTTON_CLASSES =
  "inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-sm font-semibold shadow-md shadow-violet-500/25 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500";

const SECONDARY_BUTTON_CLASSES =
  "inline-flex items-center gap-2 h-11 px-5 rounded-xl border border-violet-300 dark:border-violet-500/30 text-violet-700 dark:text-violet-300 text-sm font-semibold hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500";

const TABLE_HEAD_CELL_CLASSES =
  "px-5 sm:px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400";

const TABLE_BODY_CELL_CLASSES = "px-5 sm:px-6 py-3.5";

/**
 * Cashier home: today's activity at a glance — the two daily actions
 * (input kasbon, input pembayaran), three metrics and the latest
 * transactions. Server component; metrics come from the dummy data
 * module until the real data layer lands.
 */
export function CashierDashboard({ userName, businessName }) {
  const data = getCashierDashboardData();

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn">
      {/* Greeting + daily actions */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#181126] dark:text-white">
            Halo, {userName}
          </h1>
          <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-300">
            {businessName} · Ringkasan aktivitas kasir hari ini
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <GuardedLink
            href="/dashboard/transaksi-baru"
            className={PRIMARY_BUTTON_CLASSES}
          >
            <Plus className="w-4.5 h-4.5" />
            Input transaksi kasbon
          </GuardedLink>
          <GuardedLink
            href="/dashboard/pembayaran"
            className={SECONDARY_BUTTON_CLASSES}
          >
            <Wallet className="w-4.5 h-4.5" />
            Input pembayaran
          </GuardedLink>
        </div>
      </div>

      {/* Today's metrics */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard
          icon={Receipt}
          label="Transaksi hari ini"
          value={String(data.todayTransactionCount)}
          hint="Kasbon yang tercatat hari ini"
        />
        <StatCard
          icon={HandCoins}
          label="Kasbon baru hari ini"
          value={formatIDR(data.todayNewCreditTotal)}
          hint="Total nominal kasbon baru"
        />
        <StatCard
          icon={Wallet}
          label="Pembayaran diterima hari ini"
          value={formatIDR(data.todayPaymentsReceived)}
          hint="Sudah masuk kas toko"
        />
      </div>

      {/* Latest transactions */}
      <section className="mt-10">
        <SectionHeading
          title="Transaksi terbaru"
          description="5 transaksi kasbon terakhir yang tercatat hari ini."
        />
        <div className="mt-4 glass-panel rounded-2xl border border-white/60 dark:border-white/20 shadow-lg overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-gray-200/70 dark:border-white/10 text-left">
                <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                  Pelanggan
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
              {data.recentTransactions.map((transaction) => (
                <tr
                  key={transaction.id}
                  className="border-b border-gray-100/80 dark:border-white/5 last:border-b-0 hover:bg-violet-50/60 dark:hover:bg-white/5 transition-colors"
                >
                  <td
                    className={`${TABLE_BODY_CELL_CLASSES} font-semibold text-gray-900 dark:text-white`}
                  >
                    {transaction.customerName}
                  </td>
                  <td
                    className={`${TABLE_BODY_CELL_CLASSES} tabular-nums text-gray-700 dark:text-gray-300`}
                  >
                    {formatIDR(transaction.amount)}
                  </td>
                  <td className={TABLE_BODY_CELL_CLASSES}>
                    <PaymentStatusBadge value={transaction.paymentStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
