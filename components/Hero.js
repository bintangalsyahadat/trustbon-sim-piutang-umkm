"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  MessageSquare,
  Sparkles,
  UserCheck,
  ChevronRight
} from "lucide-react";

export function Hero({ isAuthenticated = false }) {
  const router = useRouter();
  // Interactive state for hero preview
  const [activeTab, setActiveTab] = useState("transaksi"); // 'transaksi' | 'pelanggan' | 'whatsapp'
  const [isApproved, setIsApproved] = useState(false);

  return (
    <section
      id="hero"
      className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Copywriting & CTA */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            {/* Tagline Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-200 dark:border-violet-500/20 bg-violet-50/80 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 text-xs font-semibold backdrop-blur-sm shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
              <span>Sistem Manajemen Piutang Multi-Tenant UMKM</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#181126] dark:text-white leading-[1.18]">
              Catat Kasbon Lebih Tenang.{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-500 to-purple-600 dark:from-violet-400 dark:to-purple-300">
                Lindungi Modal UMKM
              </span>{" "}
              dengan Skor Risiko Kredit.
            </h1>

            {/* Sub-headline explaining differentiation vs BukuWarung / BukuKas */}
            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
              Bukan sekadar buku kasbon biasa seperti <span className="font-medium text-gray-800 dark:text-gray-200">BukuWarung</span> atau <span className="font-medium text-gray-800 dark:text-gray-200">BukuKas</span>. TrustBon secara otomatis menghitung{" "}
              <strong className="text-violet-700 dark:text-violet-300 font-semibold">
                Skor Kepercayaan Pelanggan (0–100)
              </strong>
              , mendeteksi risiko kredit macet lebih awal, dan memproteksi limit utang dengan persetujuan Pemilik.
            </p>

            {/* CTA Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              {isAuthenticated ? (
                <button
                  id="hero-cta-dashboard"
                  type="button"
                  onClick={() => router.push("/dashboard")}
                  className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-violet-500 hover:bg-violet-600 text-white font-semibold text-base shadow-lg shadow-violet-500/30 hover:shadow-violet-500/45 dark:shadow-black/30 dark:hover:shadow-black/40 transition-all flex items-center justify-center gap-2 hover:translate-y-[-1px] active:translate-y-0"
                >
                  <span>Ke Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <>
                  <button
                    id="hero-cta-daftar"
                    type="button"
                    onClick={() => router.push("/register")}
                    className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-violet-500 hover:bg-violet-600 text-white font-semibold text-base shadow-lg shadow-violet-500/30 hover:shadow-violet-500/45 dark:shadow-black/30 dark:hover:shadow-black/40 transition-all flex items-center justify-center gap-2 hover:translate-y-[-1px] active:translate-y-0"
                  >
                    <span>Daftar Gratis Sekarang</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    id="hero-cta-masuk"
                    type="button"
                    onClick={() => router.push("/login")}
                    className="w-full sm:w-auto px-7 py-3.5 rounded-xl border border-violet-200 dark:border-violet-500/20 bg-white/70 dark:bg-white/5 text-violet-900 dark:text-violet-200 font-semibold text-base hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors flex items-center justify-center gap-2"
                  >
                    <span>Masuk ke Akun</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Right Column: Interactive Glassmorphism Hero Showcase */}
          <div className="lg:col-span-5">
            <div className="relative">
              {/* Main Glass Card */}
              <div
                id="hero-interactive-card"
                className="glass-card rounded-2xl p-4 sm:p-5 shadow-xl border border-white/20 dark:border-white/10 relative overflow-hidden"
              >
                {/* Header of Simulated App */}
                <div className="flex items-center gap-2.5 pb-3 mb-4 border-b border-gray-200/60 dark:border-white/10">
                  <div className="w-9 h-9 rounded-lg bg-violet-500 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    TB
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xs font-bold text-gray-900 dark:text-white truncate">
                      Warung Sembako Barokah
                    </h2>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">
                      Kode: <span className="font-mono font-semibold">BRK-7712</span>
                    </p>
                  </div>
                  <span className="ml-auto text-[10px] px-2 py-0.5 bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 rounded-full font-medium shrink-0">
                    Pemilik
                  </span>
                </div>

                {/* Tab switcher — full width below header */}
                <div className="flex gap-1.5 p-1 rounded-xl bg-gray-100 dark:bg-white/5 mb-4">
                  {[{key:"transaksi",label:"Persetujuan"},{key:"pelanggan",label:"Profil Skor"},{key:"whatsapp",label:"WhatsApp"}].map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setActiveTab(t.key)}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                        activeTab === t.key
                          ? "bg-white dark:bg-violet-500/20 text-violet-700 dark:text-violet-200 shadow-sm"
                          : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-300"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* TAB 1: Transaksi Approval */}
                {activeTab === "transaksi" && (
                  <div className="space-y-3 animate-fadeIn">
                    {/* Warning banner */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50/70 dark:bg-amber-500/10 border border-amber-200/70 dark:border-amber-500/20">
                      <span className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                        Kasbon melebihi limit kredit
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25">
                        <AlertTriangle className="w-3 h-3" />
                        Over-Limit
                      </span>
                    </div>

                    {/* Transaction card */}
                    <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                          Pak Herman (Warung Kopi)
                        </span>
                        <span className="text-[10px] text-gray-400">Hari ini</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-white/5">
                          <span className="text-[10px] text-gray-500 block mb-0.5">Nominal</span>
                          <span className="text-sm font-bold text-gray-900 dark:text-white">Rp 350.000</span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-white/5">
                          <span className="text-[10px] text-gray-500 block mb-0.5">Limit</span>
                          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Rp 1.000.000</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between py-2 border-t border-gray-100 dark:border-white/5">
                        <span className="text-xs text-gray-500">Status</span>
                        {isApproved ? (
                          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Dikonfirmasi
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                            Draf — Menunggu Persetujuan
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between py-2 border-t border-gray-100 dark:border-white/5">
                        <span className="text-xs text-gray-500">Pembayaran</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300 border border-rose-200 dark:border-rose-500/25">
                          Belum Dibayar
                        </span>
                      </div>

                      <div className="pt-3">
                        {isApproved ? (
                          <div className="w-full py-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/25 text-emerald-800 dark:text-emerald-300 text-center text-xs font-semibold flex items-center justify-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            Dikonfirmasi oleh Pemilik!
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setIsApproved(true)}
                            className="w-full py-2.5 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-1.5"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            Setujui Transaksi
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: Profil Skor */}
                {activeTab === "pelanggan" && (
                  <div className="space-y-3 animate-fadeIn">
                    <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                            Ibu Suryati
                          </h4>
                          <p className="text-[10px] text-gray-500">Toko Kelontong • 0812-9876-5432</p>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/25">
                          Aman
                        </span>
                      </div>

                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex flex-col items-center justify-center shadow-md">
                          <span className="text-lg font-extrabold leading-none">88</span>
                          <span className="text-[9px] uppercase tracking-wider font-semibold opacity-90">Skor</span>
                        </div>
                        <div className="flex-1 space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-500">Kesehatan Kredit</span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">Sangat Terpercaya</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: "88%" }}></div>
                          </div>
                          <p className="text-[10px] text-gray-400">12/12 transaksi lunas sebelum jatuh tempo</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-white/5">
                          <span className="text-[10px] text-gray-500 block mb-0.5">Batas Kredit</span>
                          <span className="text-sm font-bold text-gray-900 dark:text-white">Rp 2.000.000</span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-white/5">
                          <span className="text-[10px] text-gray-500 block mb-0.5">Sisa Limit</span>
                          <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Rp 1.450.000</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-violet-50 dark:bg-violet-500/10 border border-violet-200/60 dark:border-violet-500/20 text-[11px] text-violet-800 dark:text-violet-300">
                      💡 Pelanggan <em>Aman</em> berhak mendapat kenaikan limit hingga Rp 3.000.000.
                    </div>
                  </div>
                )}

                {/* TAB 3: WhatsApp Reminder */}
                {activeTab === "whatsapp" && (
                  <div className="space-y-3 animate-fadeIn">
                    {/* Chat bubble */}
                    <div className="p-4 rounded-xl bg-emerald-100/40 dark:bg-emerald-500/10 border border-emerald-300/60 dark:border-emerald-500/20 text-xs text-gray-800 dark:text-gray-200 space-y-2 leading-relaxed">
                      <div className="flex items-center gap-2 mb-1">
                        <MessageSquare className="w-4 h-4 text-emerald-600" />
                        <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">WhatsApp • Terkirim</span>
                      </div>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        Halo Pak Herman yang baik 🙏
                      </p>
                      <p>
                        Pengingat ramah dari <strong>Warung Barokah</strong>. Kasbon Rp 350.000 jatuh tempo pada <strong>15 Sept 2026</strong>.
                      </p>
                      <p className="text-[10px] text-gray-400 pt-1 border-t border-emerald-200/40 dark:border-emerald-500/20">
                        Terima kasih atas kepercayaannya! ✨
                      </p>
                    </div>

                    <div className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center justify-between px-1">
                      <span>Kanal: <strong>WhatsApp Business</strong></span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Otomatis H-2</span>
                    </div>
                  </div>
                )}

                {/* Footer nav hint */}
                <div className="mt-4 pt-3 border-t border-gray-200/60 dark:border-white/10 flex items-center justify-between text-[11px]">
                  <span className="text-gray-400 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-violet-500" />
                    Multi-Tenant
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (activeTab === "transaksi") setActiveTab("pelanggan");
                      else if (activeTab === "pelanggan") setActiveTab("whatsapp");
                      else setActiveTab("transaksi");
                    }}
                    className="text-violet-600 dark:text-violet-400 font-semibold hover:underline flex items-center gap-0.5"
                  >
                    Lihat lainnya
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
