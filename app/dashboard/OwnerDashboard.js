import {
  Banknote,
  CircleCheck,
  Clock,
  Download,
  ShieldAlert,
  Users,
} from "lucide-react";
import { GuardedLink } from "@/components/GuardedLink";
import { StatCard } from "@/components/dashboard/StatCard";
import { SectionHeading } from "@/components/dashboard/SectionHeading";
import { InsightCard } from "@/components/dashboard/InsightCard";
import { TrustStatusBadge } from "@/components/dashboard/StatusBadge";
import { getOwnerDashboardData } from "@/lib/dashboard-dummy";
import { formatIDR, formatPercent } from "@/lib/format";

const SECONDARY_BUTTON_CLASSES =
  "inline-flex items-center gap-2 h-11 px-5 rounded-xl border border-violet-300 dark:border-violet-500/30 text-violet-700 dark:text-violet-300 text-sm font-semibold hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500";

const TABLE_HEAD_CELL_CLASSES =
  "px-5 sm:px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400";

const TABLE_BODY_CELL_CLASSES = "px-5 sm:px-6 py-3.5";

/**
 * Owner home: business-level health — receivables metrics, narrative
 * insights and the customers that need attention. Server component;
 * metrics come from the dummy data module until the real data layer lands.
 */
export function OwnerDashboard({ userName, businessName }) {
  const data = getOwnerDashboardData();

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn">
      {/* Business identity + report export */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#181126] dark:text-white">
            {businessName}
          </h1>
          <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-300">
            Halo, {userName} — berikut kesehatan piutang bisnis Anda hari ini.
          </p>
        </div>
        <GuardedLink href="/dashboard/laporan" className={SECONDARY_BUTTON_CLASSES}>
          <Download className="w-4.5 h-4.5" />
          Export laporan
        </GuardedLink>
      </div>

      {/* Receivables metrics */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          icon={Banknote}
          label="Total piutang aktif"
          value={formatIDR(data.totalActiveReceivables)}
          hint="Seluruh kasbon yang belum lunas"
        />
        <StatCard
          icon={Users}
          label="Pelanggan aktif"
          value={String(data.activeCustomers)}
          hint="Memiliki kasbon berjalan"
        />
        <StatCard
          icon={ShieldAlert}
          label="Pelanggan risiko tinggi"
          value={String(data.highRiskCustomers)}
          hint="Perlu penagihan segera"
        />
        <StatCard
          icon={Clock}
          label="Pembayaran tepat waktu"
          value={formatPercent(data.onTimePaymentPercent)}
          hint="30 hari terakhir"
        />
      </div>

      {/* Narrative insights */}
      <section className="mt-10">
        <SectionHeading
          title="Insight"
          description="Sorotan otomatis dari aktivitas piutang Anda."
        />
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-5">
          {data.insights.map((insight) => (
            <InsightCard key={insight.id}>{insight.text}</InsightCard>
          ))}
        </div>
      </section>

      {/* Customers needing attention */}
      <section className="mt-10">
        <SectionHeading
          title="Perlu perhatian"
          description="Pelanggan dengan skor kepercayaan menurun atau tunggakan aktif."
        />
        <div className="mt-4 glass-panel rounded-2xl border border-white/60 dark:border-white/20 shadow-lg overflow-x-auto">
          {data.attention.length === 0 ? (
            <div className="px-6 py-10 flex flex-col items-center text-center">
              <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-500/25 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
                <CircleCheck className="w-5 h-5" />
              </div>
              <p className="mt-3 text-sm font-bold text-gray-900 dark:text-white">
                Semua pelanggan terkendali
              </p>
              <p className="mt-1 max-w-sm text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                Tidak ada pelanggan berisiko tinggi atau dalam pemulihan saat
                ini. Pertahankan!
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-gray-200/70 dark:border-white/10 text-left">
                  <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                    Pelanggan
                  </th>
                  <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                    Sisa Utang
                  </th>
                  <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.attention.map((customer) => (
                  <tr
                    key={customer.id}
                    className="border-b border-gray-100/80 dark:border-white/5 last:border-b-0 hover:bg-violet-50/60 dark:hover:bg-white/5 transition-colors"
                  >
                    <td
                      className={`${TABLE_BODY_CELL_CLASSES} font-semibold text-gray-900 dark:text-white`}
                    >
                      {customer.customerName}
                    </td>
                    <td
                      className={`${TABLE_BODY_CELL_CLASSES} tabular-nums text-gray-700 dark:text-gray-300`}
                    >
                      {formatIDR(customer.outstandingAmount)}
                    </td>
                    <td className={TABLE_BODY_CELL_CLASSES}>
                      <TrustStatusBadge value={customer.trustStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
