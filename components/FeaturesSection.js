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
import { ScrollReveal } from "./ScrollReveal";

export function FeaturesSection({ onExploreScore }) {
  // The landing page is now a server component, so it cannot pass this
  // callback. Fall back to scrolling directly to the simulator section.
  const handleExploreScore = () => {
    if (typeof onExploreScore === "function") {
      onExploreScore();
      return;
    }
    const el = document.getElementById("simulasi");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section id="fitur" className="scroll-mt-24 py-14 md:py-20 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-10 md:mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-100 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 text-violet-700 dark:text-violet-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Solusi Unggulan TrustBon</span>
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#181126] dark:text-white tracking-tight">
            Fitur Pintar yang Menjaga Arus Kas Usaha Tetap Sehat
          </h2>
          <p className="text-gray-600 dark:text-gray-300 text-sm sm:text-base leading-relaxed">
                Kombinasi skoring otomatis, AI-powered insight, pengingat WhatsApp, dan kontrol persetujuan Pemilik.
          </p>
        </div>

        {/* 3 Column Feature Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* FITUR 1: Skoring Risiko Kredit Otomatis */}
          <div
            id="feature-credit-scoring"
            className="glass-card rounded-2xl p-7 flex flex-col justify-between shadow-md hover:shadow-lg transition-all duration-300 hover:translate-y-[-3px] border border-white/20 dark:border-white/10"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-violet-500 text-white flex items-center justify-center mb-5 shadow-md shadow-violet-500/20 dark:shadow-black/20">
                <Gauge className="w-6 h-6" />
              </div>

              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2.5">
                Skoring Risiko Kredit Otomatis
              </h3>

              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-5">
                Skoring otomatis berdasarkan riwayat bayar dan frekuensi transaksi pelanggan.
              </p>

              <div className="hidden lg:block space-y-2 p-3.5 rounded-xl bg-violet-50/50 dark:bg-violet-500/10 border border-violet-100 dark:border-violet-500/20 mb-6 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 dark:bg-emerald-400"></span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">Aman (Skor 70-100)</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/25">
                    Aman / Layak Kasbon
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 dark:bg-amber-400"></span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">Waspada (Skor 40-69)</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25">
                    Waspada / Limit Ketat
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 dark:bg-rose-400"></span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">Bahaya (Skor 0-39)</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/25">
                    Bahaya / Stop Kredit
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleExploreScore}
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
            className="glass-card rounded-2xl p-7 flex flex-col justify-between shadow-md hover:shadow-lg transition-all duration-300 hover:translate-y-[-3px] border border-white/20 dark:border-white/10"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-violet-500 text-white flex items-center justify-center mb-5 shadow-md shadow-violet-500/20 dark:shadow-black/20">
                <MessageSquareCheck className="w-6 h-6" />
              </div>

              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2.5">
                Reminder Otomatis via WhatsApp
              </h3>

              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-5">
                Pesan pengingat sopan otomatis dikirim ke WhatsApp pelanggan sesuai jadwal jatuh tempo.
              </p>

              <div className="hidden lg:block space-y-2.5 p-3.5 rounded-xl bg-violet-50/50 dark:bg-violet-500/10 border border-violet-100 dark:border-violet-500/20 mb-6 text-xs">
                <div className="p-2.5 rounded-lg bg-white dark:bg-white/5 border border-emerald-200 dark:border-emerald-500/25 shadow-xs">
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
            className="glass-card rounded-2xl p-7 flex flex-col justify-between shadow-md hover:shadow-lg transition-all duration-300 hover:translate-y-[-3px] border border-white/20 dark:border-white/10"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-violet-500 text-white flex items-center justify-center mb-5 shadow-md shadow-violet-500/20 dark:shadow-black/20">
                <LayoutDashboard className="w-6 h-6" />
              </div>

              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2.5">
                Dashboard Kesehatan Piutang & Insight
              </h3>

              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-5">
                Pantau indikator piutang real-time: rasio lancar vs macet, dan antrean persetujuan kasbon.
              </p>

              <div className="hidden lg:block space-y-2.5 p-3.5 rounded-xl bg-gradient-to-br from-violet-500/10 to-purple-600/5 dark:from-violet-500/10 dark:to-violet-500/5 border border-violet-200/80 dark:border-violet-500/20 mb-6 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-semibold text-violet-950 dark:text-violet-200">
                    Persetujuan Pemilik Dibutuhkan
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 border border-amber-300 dark:border-amber-500/25">
                    2 Draf Transaksi
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                  <div className="p-2 rounded-lg bg-white/80 dark:bg-white/5 border border-violet-100 dark:border-white/10">
                    <span className="text-[10px] text-gray-500 block">Total Piutang:</span>
                    <span className="font-bold text-gray-900 dark:text-white">Rp 14.850.000</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white/80 dark:bg-white/5 border border-violet-100 dark:border-white/10">
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
        </ScrollReveal>
      </div>
    </section>
  );
}
