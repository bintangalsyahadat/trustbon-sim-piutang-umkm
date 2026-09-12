"use client";

import {
  Gauge,
  MessageSquareCheck,
  LayoutDashboard,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Clock,
  CheckCircle,
  FileCheck2,
  Sparkles,
  Zap,
  ArrowRight
} from "lucide-react";

export function FeaturesSection({ onExploreScore }) {
  return (
    <section id="fitur" className="py-20 relative">
      {/* Background glow in violet/purple */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-96 h-96 bg-purple-500/10 dark:bg-purple-900/15 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-100 dark:bg-purple-950/70 border border-violet-200 dark:border-purple-800 text-violet-700 dark:text-violet-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Solusi Unggulan TrustBon</span>
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#181126] dark:text-white tracking-tight">
            Fitur Pintar yang Menjaga Arus Kas Usaha Tetap Sehat
          </h2>
          <p className="text-gray-600 dark:text-gray-300 text-sm sm:text-base leading-relaxed">
            Kombinasi skoring rule-based, otomatisasi pesan WhatsApp ramah, dan kontrol persetujuan Owner untuk mengeliminasi risiko piutang macet.
          </p>
        </div>

        {/* 3 Column Feature Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* FITUR 1: Skoring Risiko Kredit Otomatis */}
          <div
            id="feature-credit-scoring"
            className="glass-card rounded-2xl p-7 flex flex-col justify-between shadow-lg hover:shadow-violet-500/10 transition-all duration-300 hover:translate-y-[-3px] border border-white/60 dark:border-purple-800/30"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-violet-600 text-white flex items-center justify-center mb-5 shadow-md shadow-violet-500/20">
                <Gauge className="w-6 h-6" />
              </div>

              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2.5">
                Skoring Risiko Kredit Otomatis
              </h3>

              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-5">
                Algoritma rule-based TrustBon mengevaluasi setiap pelunasan, frekuensi transaksi, dan riwayat jatuh tempo pelanggan untuk menghasilkan nilai <strong>riskScore (0–100)</strong> dan kategori status kepercayaan.
              </p>

              {/* Status Visual Badges according to prompt rules: Hijau (stable), Kuning (recovering), Merah (at_risk) */}
              <div className="space-y-2 p-3.5 rounded-xl bg-violet-50/50 dark:bg-purple-950/40 border border-violet-100 dark:border-purple-900/40 mb-6 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">Stable (Skor 70-100)</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800">
                    Aman / Layak Kasbon
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">Recovering (Skor 40-69)</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800">
                    Waspada / Limit Ketat
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">At Risk (Skor 0-39)</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800">
                    Bahaya / Stop Kredit
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => onExploreScore && onExploreScore()}
                className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1.5"
              >
                <span>Coba kalkulator simulasi skoring</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* FITUR 2: Reminder Otomatis via WhatsApp */}
          <div
            id="feature-whatsapp-reminder"
            className="glass-card rounded-2xl p-7 flex flex-col justify-between shadow-lg hover:shadow-violet-500/10 transition-all duration-300 hover:translate-y-[-3px] border border-white/60 dark:border-purple-800/30"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-violet-600 text-white flex items-center justify-center mb-5 shadow-md shadow-violet-500/20">
                <MessageSquareCheck className="w-6 h-6" />
              </div>

              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2.5">
                Reminder Otomatis via WhatsApp
              </h3>

              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-5">
                Tak perlu lagi sungkan atau canggung saat menagih. Pesan pengingat diformat sopan, ramah, dan otomatis dikirimkan ke WhatsApp pelanggan sesuai jadwal jatuh tempo.
              </p>

              {/* Chat Simulation Preview */}
              <div className="space-y-2.5 p-3.5 rounded-xl bg-violet-50/50 dark:bg-purple-950/40 border border-violet-100 dark:border-purple-900/40 mb-6 text-xs">
                <div className="p-2.5 rounded-lg bg-white dark:bg-purple-950/80 border border-emerald-200 dark:border-emerald-800/60 shadow-xs">
                  <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 mb-1 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Template Tagihan Ramah (Hari H)
                  </p>
                  <p className="text-[11px] text-gray-700 dark:text-gray-300 italic">
                    &quot;Halo Ibu Dian, terima kasih atas kepercayaannya berbelanja di Toko Berkah. Kasbon Rp 120.000 jatuh tempo hari ini...&quot;
                  </p>
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 px-1">
                  <span>Pilihan Kanal: <strong>WhatsApp / SMS</strong></span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Terkonfirmasi</span>
                </div>
              </div>
            </div>

            <div className="pt-2 text-xs text-gray-500 dark:text-gray-400">
              ✓ Pelanggan dapat link rincian item kasbon tanpa perlu instal aplikasi
            </div>
          </div>

          {/* FITUR 3: Dashboard Kesehatan Piutang & Insight */}
          <div
            id="feature-receivable-dashboard"
            className="glass-card rounded-2xl p-7 flex flex-col justify-between shadow-lg hover:shadow-violet-500/10 transition-all duration-300 hover:translate-y-[-3px] border border-white/60 dark:border-purple-800/30"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-violet-600 text-white flex items-center justify-center mb-5 shadow-md shadow-violet-500/20">
                <LayoutDashboard className="w-6 h-6" />
              </div>

              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2.5">
                Dashboard Kesehatan Piutang & Insight
              </h3>

              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-5">
                Pantau seluruh indikator piutang toko Anda secara real-time. Ketahui rasio kasbon lancar vs macet, serta kelola antrean persetujuan transaksi yang melebihi limit kredit.
              </p>

              {/* Insight KPI Preview Card in brand violet accent */}
              <div className="space-y-2.5 p-3.5 rounded-xl bg-gradient-to-br from-violet-600/10 to-purple-600/5 dark:from-purple-900/30 dark:to-violet-900/20 border border-violet-200/80 dark:border-purple-800/50 mb-6 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-semibold text-violet-950 dark:text-violet-200">
                    Persetujuan Owner Dibutuhkan
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                    2 Draft Transaksi
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                  <div className="p-2 rounded-lg bg-white/80 dark:bg-purple-950/60 border border-violet-100 dark:border-purple-900/40">
                    <span className="text-[10px] text-gray-500 block">Total Piutang:</span>
                    <span className="font-bold text-gray-900 dark:text-white">Rp 14.850.000</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white/80 dark:bg-purple-950/60 border border-violet-100 dark:border-purple-900/40">
                    <span className="text-[10px] text-gray-500 block">Tingkat Kolektibilitas:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">92.4% Lancar</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 text-xs text-gray-500 dark:text-gray-400">
              ✓ Multi-tenant: Pisahkan akses kasir dan pemilik usaha
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
