"use client";

import { EyeOff, UserX, AlertOctagon, ArrowUpRight, HelpCircle } from "lucide-react";

export function ProblemsSection() {
  const problems = [
    {
      id: "problem-blind-risk",
      icon: EyeOff,
      badge: "Buta Karakter",
      badgeColor: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800",
      title: "Hanya Catat Angka, Buta Riwayat Bayar Pelanggan",
      description:
        "Buku kasbon biasa seperti BukuWarung atau BukuKas hanya mencatat 'siapa berutang berapa'. Anda tidak tahu apakah pelanggan tersebut punya riwayat selalu nunggak berbulan-bulan atau punya itikad baik sebelum menyetujui kasbon berikutnya.",
      impact: "Modal kerja tertahan karena memberi kasbon baru pada pelanggan yang berisiko tinggi macet.",
    },
    {
      id: "problem-awkward-collection",
      icon: AlertOctagon,
      badge: "Sungkan Menagih",
      badgeColor: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800",
      title: "Rasa Sungkan Membuat Penagihan Sering Terlambat",
      description:
        "Menagih kasbon ke tetangga, teman, atau langganan sering menimbulkan rasa canggung. Karena enggan menagih langsung secara tatap muka, jatuh tempo terlewat hingga berbulan-bulan dan piutang berakhir jadi beban kerugian.",
      impact: "Arus kas tersendat hanya karena penagihan manual terasa membebani mental pemilik warung.",
    },
    {
      id: "problem-cashier-bypass",
      icon: UserX,
      badge: "Kasir Tanpa Limit",
      badgeColor: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800",
      title: "Kasir Meloloskan Kasbon Tanpa Kontrol Pemilik Toko",
      description:
        "Saat kasir jaga toko, pelanggan sering meminta izin kasbon tambahan. Kasir yang sungkan atau tidak tahu aturan batas kredit sering meloloskannya begitu saja tanpa konfirmasi langsung kepada Owner.",
      impact: "Piutang melonjak melebihi batas toleransi tanpa persetujuan dan verifikasi pemilik UMKM.",
    },
  ];

  return (
    <section id="masalah" className="py-20 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-100 dark:bg-purple-950/70 border border-violet-200 dark:border-purple-800 text-violet-700 dark:text-violet-300 text-xs font-semibold">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Masalah Nyata di Lapangan</span>
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#181126] dark:text-white tracking-tight">
            Kenapa Pencatatan Manual & Aplikasi Kasbon Biasa Tidak Cukup?
          </h2>
          <p className="text-gray-600 dark:text-gray-300 text-sm sm:text-base leading-relaxed">
            Mencatat utang saja tidak menyelesaikan akar masalah piutang macet. Inilah 3 alasan kenapa warung dan UMKM membutuhkan sistem yang lebih protektif.
          </p>
        </div>

        {/* 3 Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {problems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                id={item.id}
                className="glass-card rounded-2xl p-6 flex flex-col justify-between transition-all duration-300 hover:translate-y-[-2px] hover:border-violet-300 dark:hover:border-purple-700 shadow-sm"
              >
                <div>
                  {/* Top Bar with Semantic Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 rounded-xl bg-violet-100 dark:bg-purple-900/50 text-violet-700 dark:text-violet-300 flex items-center justify-center font-bold">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${item.badgeColor}`}
                    >
                      {item.badge}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 leading-snug">
                    {item.title}
                  </h3>

                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
                    {item.description}
                  </p>
                </div>

                {/* Bottom Impact Box */}
                <div className="pt-3 border-t border-gray-100 dark:border-purple-900/40">
                  <div className="flex items-start gap-2 text-xs text-rose-800 dark:text-rose-300 bg-rose-50/60 dark:bg-rose-950/30 p-2.5 rounded-lg border border-rose-100 dark:border-rose-900/30">
                    <span className="font-bold text-rose-600 dark:text-rose-400">Akibat:</span>
                    <span>{item.impact}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
