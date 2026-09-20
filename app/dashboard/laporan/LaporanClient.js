"use client";

import { useState, useTransition } from "react";
import {
  Banknote,
  Wallet,
  TrendingUp,
  Clock,
  Calendar,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import { formatIDR, formatPercent } from "@/lib/format";
import { StatCard } from "@/components/dashboard/StatCard";
import { SectionHeading } from "@/components/dashboard/SectionHeading";
import { useToast } from "@/components/Toast";
import { fetchReport } from "./actions";
import { ReportCharts } from "./ReportCharts";
import { ReportTable } from "./ReportTable";
import { exportToExcel } from "./ReportExport";
import { exportToPdf } from "./ReportExportPdf";

const INPUT_CLASSES =
  "px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-violet-500 transition-colors";

const SECONDARY_BTN =
  "inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-violet-300 dark:border-violet-500/30 text-violet-700 dark:text-violet-300 text-sm font-semibold hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

const EXPORT_BTN =
  "inline-flex items-center gap-2 h-9 px-3.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-700 dark:text-gray-300 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 cursor-pointer";

export function LaporanClient({ initialData }) {
  const [data, setData] = useState(initialData);
  const [from, setFrom] = useState(initialData.period.from);
  const [to, setTo] = useState(initialData.period.to);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function handleFilter() {
    if (pending) return;
    startTransition(async () => {
      const result = await fetchReport({ from, to });
      if (result.ok) {
        setData(result.data);
        toast.success("Laporan diperbarui.");
      } else {
        toast.error(result.error || "Gagal memuat laporan.");
      }
    });
  }

  function handleQuickRange(days) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const endStr = formatDate(now);
    const start = new Date(now);
    start.setDate(start.getDate() - (days - 1));
    setFrom(formatDate(start));
    setTo(endStr);
    startTransition(async () => {
      const result = await fetchReport({
        from: formatDate(start),
        to: endStr,
      });
      if (result.ok) {
        setData(result.data);
      }
    });
  }

  const { summary, trend, riskDistribution, customers, businessName, period } =
    data;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#181126] dark:text-white">
            Laporan
          </h1>
          <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-300">
            Tinjau laporan piutang serta performa pembayaran{" "}
            {businessName}.
          </p>
        </div>
      </div>

      {/* Date filter */}
      <div className="mt-6 glass-card rounded-2xl border border-white/40 dark:border-white/10 shadow-md p-4 sm:p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
              Periode
            </span>
          </div>
          <div>
            <label
              htmlFor="laporan-from"
              className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1"
            >
              Dari
            </label>
            <input
              id="laporan-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={INPUT_CLASSES}
            />
          </div>
          <div>
            <label
              htmlFor="laporan-to"
              className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1"
            >
              Sampai
            </label>
            <input
              id="laporan-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={INPUT_CLASSES}
            />
          </div>
          <button
            type="button"
            onClick={handleFilter}
            disabled={pending}
            className={SECONDARY_BTN}
          >
            {pending ? "Memuat…" : "Terapkan"}
          </button>
          <div className="flex gap-1.5 ml-auto">
            {[
              { label: "30 hari", days: 30 },
              { label: "90 hari", days: 90 },
              { label: "1 tahun", days: 365 },
            ].map((preset) => (
              <button
                key={preset.days}
                type="button"
                onClick={() => handleQuickRange(preset.days)}
                disabled={pending}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
          Periode: {period.from} s/d {period.to} · Granularitas:{" "}
          {data.granularity === "day"
            ? "harian"
            : data.granularity === "week"
              ? "mingguan"
              : "bulanan"}
        </p>
      </div>

      {/* Section 2: Summary metrics */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          icon={Banknote}
          label="Kasbon baru"
          value={
            summary.newCreditCount > 0
              ? `${summary.newCreditCount} transaksi`
              : "—"
          }
          hint={`Total ${formatIDR(summary.newCreditTotal)}`}
        />
        <StatCard
          icon={Wallet}
          label="Pembayaran diterima"
          value={
            summary.paymentsCount > 0
              ? `${summary.paymentsCount} pembayaran`
              : "—"
          }
          hint={`Total ${formatIDR(summary.paymentsReceivedTotal)}`}
        />
        <StatCard
          icon={TrendingUp}
          label="Tingkat kolektibilitas"
          value={
            summary.collectibilityRate !== null
              ? formatPercent(summary.collectibilityRate)
              : "—"
          }
          hint="Persentase transaksi lunas"
        />
        <StatCard
          icon={Clock}
          label="Rata-rata keterlambatan"
          value={
            summary.avgDaysLate !== null
              ? `${Math.round(summary.avgDaysLate)} hari`
              : "—"
          }
          hint="Rata-rata hari setelah jatuh tempo"
        />
      </div>

      {/* Section 3: Trend charts */}
      <section className="mt-10">
        <SectionHeading
          title="Tren"
          description="Perkembangan piutang dan pembayaran dari waktu ke waktu."
        />
        <ReportCharts trend={trend} />
      </section>

      {/* Section 4: Risk distribution */}
      <section className="mt-10">
        <SectionHeading
          title="Distribusi Risiko"
          description="Jumlah pelanggan berdasarkan status kepercayaan."
        />
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {riskDistribution.map((item) => (
            <RiskDistCard key={item.trustStatus} item={item} />
          ))}
        </div>
      </section>

      {/* Section 5: Customer table */}
      <section className="mt-10">
        <SectionHeading
          title="Detail Pelanggan"
          description="Rincian piutang dan risiko per pelanggan dalam periode yang dipilih."
        />
        <ReportTable customers={customers} />
      </section>

      {/* Section 6: Export */}
      <section className="mt-10 mb-6">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => exportToExcel(data)}
            className={EXPORT_BTN}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Ekspor Excel
          </button>
          <button
            type="button"
            onClick={() => exportToPdf(data)}
            className={EXPORT_BTN}
          >
            <FileText className="w-3.5 h-3.5" />
            Ekspor PDF
          </button>
        </div>
      </section>
    </div>
  );
}

function RiskDistCard({ item }) {
  const labelMap = {
    stable: "Aman",
    recovering: "Pemulihan",
    at_risk: "Risiko Tinggi",
    unrated: "Belum Dinilai",
  };
  const colorMap = {
    stable: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300",
    recovering:
      "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-300",
    at_risk:
      "bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-300",
    unrated:
      "bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400",
  };
  return (
    <div
      className={`glass-card rounded-xl border p-4 ${colorMap[item.trustStatus]}`}
    >
      <p className="text-2xl font-extrabold tabular-nums">{item.count}</p>
      <p className="mt-1 text-xs font-semibold">{labelMap[item.trustStatus]}</p>
    </div>
  );
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
