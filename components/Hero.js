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
  Lock,
  UserCheck,
  Building2,
  ChevronRight,
  Users
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
              , mendeteksi risiko kredit macet lebih awal, dan memproteksi limit utang dengan persetujuan Owner.
            </p>

            <p className="text-sm text-violet-600 dark:text-violet-300 font-medium leading-relaxed">
              UMKM menyumbang lebih dari 60% PDB Indonesia. TrustBon menjaga
              keberlanjutan ekonomi lokal dengan melindungi modal kerja dan
              membangun sistem kepercayaan antar pelaku usaha.
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

            {/* Trust points */}
            <div className="pt-4 border-t border-violet-100/80 dark:border-white/10 grid grid-cols-3 gap-3 text-left">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                  <span>Rule-Based Skoring</span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Kalkulasi otomatis riwayat bayar
                </p>
              </div>

              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300">
                  <Lock className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                  <span>Proteksi Limit</span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Kasir tak bisa loloskan utang over-limit
                </p>
              </div>

              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                  <span>WhatsApp Reminder</span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Tagihan sopan terjadwal rapi
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Glassmorphism Hero Showcase */}
          <div className="lg:col-span-5">
            <div className="relative">
              {/* Main Glass Card */}
              <div
                id="hero-interactive-card"
                className="glass-card rounded-2xl p-5 shadow-xl border border-white/20 dark:border-white/10 relative overflow-hidden"
              >
                {/* Header of Simulated App */}
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-200/60 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-violet-500 text-white flex items-center justify-center font-bold text-xs">
                      TB
                    </div>
                    <div>
                      <h2 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                        Warung Sembako Barokah
                        <span className="text-[10px] px-1.5 py-0.2 bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 rounded font-medium">
                          Owner
                        </span>
                      </h2>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">
                        Kode Invite: <span className="font-mono font-semibold">BRK-7712</span>
                      </p>
                    </div>
                  </div>

                  {/* Interactive toggle view */}
                  <div className="flex items-center gap-1 p-0.5 rounded-lg bg-gray-100 dark:bg-white/5 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setActiveTab("transaksi")}
                      className={`px-2 py-1 rounded-md font-medium transition-colors ${
                        activeTab === "transaksi"
                          ? "bg-white dark:bg-violet-500/20 text-violet-700 dark:text-violet-200 shadow-xs"
                          : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-300"
                      }`}
                    >
                      Approval
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("pelanggan")}
                      className={`px-2 py-1 rounded-md font-medium transition-colors ${
                        activeTab === "pelanggan"
                          ? "bg-white dark:bg-violet-500/20 text-violet-700 dark:text-violet-200 shadow-xs"
                          : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-300"
                      }`}
                    >
                      Profil Skor
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("whatsapp")}
                      className={`px-2 py-1 rounded-md font-medium transition-colors ${
                        activeTab === "whatsapp"
                          ? "bg-white dark:bg-violet-500/20 text-violet-700 dark:text-violet-200 shadow-xs"
                          : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-300"
                      }`}
                    >
                      WhatsApp
                    </button>
                  </div>
                </div>

                {/* TAB 1: Transaksi Lifecycle & Approval Over-Limit */}
                {activeTab === "transaksi" && (
                  <div className="space-y-3.5 animate-fadeIn">
                    <div className="p-3 rounded-xl bg-violet-50/70 dark:bg-violet-500/10 border border-violet-200/70 dark:border-violet-500/20">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-[11px] font-semibold text-violet-950 dark:text-violet-200">
                            Peringatan Transaksi Kasir
                          </p>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400">
                            Kasbon melebihi limit kredit pelanggan
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25">
                          <AlertTriangle className="w-3 h-3" />
                          Over-Limit
                        </span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 space-y-2.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-gray-800 dark:text-gray-200">
                          Pak Herman (Warung Kopi)
                        </span>
                        <span className="text-gray-500 text-[10px]">Hari ini, 10:15 WIB</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="p-2 rounded-lg bg-gray-50 dark:bg-white/5">
                          <span className="text-gray-500 text-[10px] block">Nominal Transaksi:</span>
                          <span className="font-bold text-gray-900 dark:text-white">Rp 350.000</span>
                        </div>
                        <div className="p-2 rounded-lg bg-gray-50 dark:bg-white/5">
                          <span className="text-gray-500 text-[10px] block">Limit Kredit:</span>
                          <span className="font-medium text-gray-700 dark:text-gray-300">Rp 1.000.000</span>
                        </div>
                      </div>

                      {/* Technical Architecture Note explicitly rendered for the user */}
                      <div className="pt-1 flex items-center justify-between text-[11px]">
                        <span className="text-gray-500 text-[10px]">Lifecycle (paymentStatus):</span>
                        {isApproved ? (
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> confirmed
                          </span>
                        ) : (
                          <span className="font-semibold text-amber-600 dark:text-amber-400">
                            draft (Menunggu Approval)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-gray-500 text-[10px]">Progres Pelunasan (status):</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300 border border-rose-200 dark:border-rose-500/25">
                          unpaid
                        </span>
                      </div>

                      <div className="pt-2">
                        {isApproved ? (
                          <div className="w-full py-2 px-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/25 text-emerald-800 dark:text-emerald-300 text-center text-xs font-semibold flex items-center justify-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            Transaksi Dikonfirmasi oleh Owner!
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setIsApproved(true)}
                            className="w-full py-2 px-3 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-1.5"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            Setujui Transaksi (Approve sebagai Owner)
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: Profil Pelanggan & Skoring Risiko Rule-Based */}
                {activeTab === "pelanggan" && (
                  <div className="space-y-3 animate-fadeIn">
                    <div className="p-3.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                            Ibu Suryati (Toko Kelontong)
                          </h4>
                          <p className="text-[10px] text-gray-500">0812-9876-5432</p>
                        </div>
                        {/* Semantic badge standard: Green for stable */}
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/25">
                          stable
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex flex-col items-center justify-center shadow-md">
                          <span className="text-base font-extrabold leading-none">88</span>
                          <span className="text-[9px] uppercase tracking-wider font-semibold opacity-90">
                            Skor
                          </span>
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-gray-500">Kesehatan Kredit:</span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              Sangat Terpercaya
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-emerald-500 h-1.5 rounded-full"
                              style={{ width: "88%" }}
                            ></div>
                          </div>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400">
                            12 dari 12 transaksi dilunasi sebelum jatuh tempo.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                        <div className="p-2 rounded-lg bg-gray-50 dark:bg-white/5">
                          <span className="text-[10px] text-gray-500 block">Batas Kredit:</span>
                          <span className="font-bold text-gray-900 dark:text-white">Rp 2.000.000</span>
                        </div>
                        <div className="p-2 rounded-lg bg-gray-50 dark:bg-white/5">
                          <span className="text-[10px] text-gray-500 block">Sisa Limit:</span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">Rp 1.450.000</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-violet-50 dark:bg-violet-500/10 border border-violet-200/60 dark:border-violet-500/20 text-[10px] text-violet-900 dark:text-violet-300">
                      💡 <strong>Rekomendasi TrustBon:</strong> Pelanggan berkategori <em>stable</em> berhak mendapatkan kenaikan limit kredit hingga Rp 3.000.000.
                    </div>
                  </div>
                )}

                {/* TAB 3: WhatsApp Reminder Automations */}
                {activeTab === "whatsapp" && (
                  <div className="space-y-3 animate-fadeIn">
                    <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-emerald-950 dark:text-emerald-200 flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                          Format WhatsApp Reminder
                        </span>
                        <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                          deliveryStatus: sent
                        </span>
                      </div>
                    </div>

                    {/* Simulated Chat Bubble */}
                    <div className="p-3 rounded-xl bg-emerald-100/40 dark:bg-emerald-500/10 border border-emerald-300/60 dark:border-emerald-500/20 text-[11px] text-gray-800 dark:text-gray-200 space-y-1.5 font-sans leading-relaxed">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        Halo Pak Herman yang baik 🙏
                      </p>
                      <p>
                        Pengingat ramah dari <strong>Warung Barokah</strong>. Kasbon belanja Anda sebesar <strong>Rp 350.000</strong> akan jatuh tempo pada <strong>15 Sept 2026</strong>.
                      </p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 pt-1">
                        Terima kasih atas kepercayaannya selalu berbelanja di toko kami! ✨
                      </p>
                    </div>

                    <div className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center justify-between px-1">
                      <span>Kanal: <strong>WhatsApp Business</strong></span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Terkirim Otomatis H-2</span>
                    </div>
                  </div>
                )}

                {/* Quick Interactive Switch Bar */}
                <div className="mt-4 pt-3 border-t border-gray-200/60 dark:border-white/10 flex items-center justify-between text-[11px]">
                  <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-violet-600 dark:text-violet-400" />
                    Multi-Tenant Ready
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
                    <span>Lihat simulasi berikutnya</span>
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
