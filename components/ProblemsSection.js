"use client";

import { EyeOff, UserX, AlertOctagon, ArrowUpRight, HelpCircle, Users } from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";

export function ProblemsSection() {
  const problems = [
    {
      id: "problem-blind-risk",
      icon: EyeOff,
      badge: "Buta Karakter",
      badgeColor: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/25",
      title: "Hanya Catat Angka, Buta Riwayat Bayar Pelanggan",
      description: "Buku kasbon biasa hanya mencatat siapa berutang berapa. Anda tidak tahu riwayat bayar pelanggan sebelum menyetujui kasbon baru.",
      impact: "Modal kerja tertahan karena memberi kasbon pada pelanggan berisiko macet.",
      communityImpact: "UMKM yang gulung tikar = lapangan kerja hilang di komunitas lokal.",
    },
    {
      id: "problem-awkward-collection",
      icon: AlertOctagon,
      badge: "Sungkan Menagih",
      badgeColor: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25",
      title: "Rasa Sungkan Membuat Penagihan Sering Terlambat",
      description: "Menagih kasbon ke tetangga atau langganan sering terasa canggung. Karena enggan menagih, jatuh tempo terlewat hingga piutang jadi beban kerugian.",
      impact: "Arus kas tersendat karena penagihan manual.",
      communityImpact: "Arus kas tersendat memperlambat roda ekonomi lokal.",
    },
    {
      id: "problem-cashier-bypass",
      icon: UserX,
      badge: "Kasir Tanpa Limit",
      badgeColor: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/25",
      title: "Kasir Meloloskan Kasbon Tanpa Kontrol Pemilik Toko",
      description: "Kasir sering meloloskan kasbon tambahan tanpa konfirmasi pemilik. Piutang melonjak melebihi batas tanpa verifikasi.",
      impact: "Piutang melonjak tanpa persetujuan pemilik UMKM.",
      communityImpact: "Kontrol buruk mengancam kelangsungan usaha kecil.",
    },
  ];

  return (
    <section id="masalah" className="scroll-mt-24 py-14 md:py-20 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-10 md:mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-100 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 text-violet-700 dark:text-violet-300 text-xs font-semibold">
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-8">
          {problems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                id={item.id}
              className="glass-card rounded-2xl p-5 md:p-6 flex flex-col justify-between transition-all duration-300 hover:translate-y-[-2px] hover:border-violet-300 dark:hover:border-purple-700 shadow-sm"
              >
                <div>
                  {/* Top Bar with Semantic Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 rounded-xl bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 flex items-center justify-center font-bold">
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
                <div className="pt-3 border-t border-gray-100 dark:border-white/10">
                  <div className="flex items-start gap-2 text-xs text-rose-800 dark:text-rose-300 bg-rose-50/60 dark:bg-rose-500/10 p-2.5 rounded-lg border border-rose-100 dark:border-rose-500/20">
                    <span className="font-bold text-rose-600 dark:text-rose-400">Akibat:</span>
                    <span>{item.impact}</span>
                  </div>
                </div>

                {item.communityImpact ? (
                  <div className="hidden md:flex mt-2 items-start gap-2 text-[11px] text-violet-700 dark:text-violet-300 bg-violet-50/50 dark:bg-violet-500/10 p-2 rounded-lg border border-violet-100 dark:border-violet-500/20">
                    <Users className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{item.communityImpact}</span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
