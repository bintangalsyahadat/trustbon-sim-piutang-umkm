"use client";

import { Building2, UserPlus, FileSpreadsheet, ArrowRight, ShieldCheck, Check } from "lucide-react";

export function HowItWorks({ onOpenRegister }) {
  const steps = [
    {
      step: "01",
      icon: Building2,
      title: "Daftar Bisnis & Atur Limit",
      subtitle: "Sebagai Pemilik (Owner)",
      description:
        "Daftarkan nama UMKM/toko Anda dalam 2 menit. Tentukan batas kredit default untuk pelanggan baru dan dapatkan Kode Invite unik toko untuk karyawan Anda.",
      details: ["Pendaftaran tanpa kartu kredit", "Pengaturan batas kredit toko", "Multi-tenant aman & terisolasi"],
    },
    {
      step: "02",
      icon: UserPlus,
      title: "Undang Kasir dengan Kode Unik",
      subtitle: "Kolaborasi Kasir & Pemilik",
      description:
        "Berikan Kode Invite toko kepada kasir. Kasir dapat login untuk mencatat kasbon pelanggan sehari-hari tanpa melihat data sensitif keuangan pemilik.",
      details: ["Akses role terbatas untuk kasir", "Kasir tak bisa ubah batas kredit", "Aman dari kebocoran pembukuan"],
    },
    {
      step: "03",
      icon: FileSpreadsheet,
      title: "Mulai Catat Kasbon & Pantau Skor",
      subtitle: "Otomasi & Proteksi Penuh",
      description:
        "Input kasbon harian. Jika melebihi limit, transaksi otomatis berstatus draft dan butuh persetujuan Owner. Sistem langsung menghitung skor risiko & menjadwalkan reminder WA.",
      details: ["Skoring risiko kredit otomatis (0-100)", "Proteksi kasbon over-limit", "Pengingat WhatsApp terintegrasi"],
    },
  ];

  return (
    <section id="cara-kerja" className="py-20 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-100 dark:bg-purple-950/70 border border-violet-200 dark:border-purple-800 text-violet-700 dark:text-violet-300 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Alur Praktis 3 Langkah</span>
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#181126] dark:text-white tracking-tight">
            Cara Kerja TrustBon untuk Warung & UMKM Anda
          </h2>
          <p className="text-gray-600 dark:text-gray-300 text-sm sm:text-base leading-relaxed">
            Mulai dalam hitungan menit tanpa instalasi rumit. Terhubung langsung antara Pemilik dan Kasir.
          </p>
        </div>

        {/* 3 Step Process Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {steps.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={item.step}
                id={`step-${item.step}`}
                className="glass-card rounded-2xl p-7 flex flex-col justify-between relative transition-all duration-300 hover:translate-y-[-2px] hover:border-violet-300 dark:hover:border-purple-700 shadow-md"
              >
                <div>
                  {/* Step Number badge and Icon */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-12 h-12 rounded-xl bg-violet-600 text-white flex items-center justify-center font-bold shadow-md shadow-violet-500/20">
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-3xl font-black text-violet-200 dark:text-purple-900/80 select-none">
                      {item.step}
                    </span>
                  </div>

                  <span className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400 block mb-1">
                    {item.subtitle}
                  </span>

                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                    {item.title}
                  </h3>

                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
                    {item.description}
                  </p>
                </div>

                {/* Checklist bullets */}
                <div className="pt-4 border-t border-gray-100 dark:border-purple-900/40 space-y-2">
                  {item.details.map((detail, dIdx) => (
                    <div key={dIdx} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <div className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                        <Check className="w-2.5 h-2.5" />
                      </div>
                      <span>{detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA Banner with Glassmorphism */}
        <div className="mt-14 glass-panel rounded-2xl p-8 text-center sm:flex sm:items-center sm:justify-between max-w-5xl mx-auto border border-violet-200/80 dark:border-purple-800/60 shadow-xl">
          <div className="text-left mb-6 sm:mb-0 space-y-1">
            <h4 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
              Siap Mencegah Piutang Macet di Usaha Anda?
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Bergabung bersama ratusan UMKM yang melindungi arus kas mereka dengan TrustBon.
            </p>
          </div>

          <button
            id="how-it-works-cta"
            type="button"
            onClick={() => onOpenRegister && onOpenRegister()}
            className="px-6 py-3.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm shadow-md shadow-violet-600/30 transition-all flex items-center justify-center gap-2 mx-auto sm:mx-0"
          >
            <span>Daftar Bisnis Sekarang</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
