"use client";

import { Landmark, HandCoins, ShieldCheck } from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";

const STATS = [
  {
    icon: Landmark,
    value: "60%+",
    label: "PDB Indonesia",
    description: "Disumbangkan oleh UMKM — sektor yang menjadi tulang punggung perekonomian nasional",
  },
  {
    icon: HandCoins,
    value: "Rp 1,8T",
    label: "Kerugian Piutang",
    description: "UMKM kehilangan potensi pendapatan akibat piutang macet yang tidak terkelola setiap tahunnya",
  },
  {
    icon: ShieldCheck,
    value: "Skor Kepercayaan",
    label: "Berkelanjutan",
    description: "Membangun sistem kepercayaan antar pelaku usaha agar rantai ekonomi lokal tetap berjalan",
  },
];

export function ImpactSection() {
  return (
    <section id="dampak" className="py-14 md:py-20 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-10 md:mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-100 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 text-violet-700 dark:text-violet-300 text-xs font-semibold">
            <Landmark className="w-3.5 h-3.5" />
            <span>Dampak untuk Komunitas</span>
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#181126] dark:text-white tracking-tight">
            Setiap UMKM yang Sehat = Komunitas yang Berkelanjutan
          </h2>
          <p className="text-gray-600 dark:text-gray-300 text-sm sm:text-base leading-relaxed">
            TrustBon bukan hanya soal mencatat utang. TrustBon menjaga rantai kepercayaan agar UMKM bisa tumbuh, membuka lapangan kerja, dan memperkuat ekonomi komunitas lokal.
          </p>
        </div>

        {/* 3 Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {STATS.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="glass-card rounded-2xl p-6 text-center shadow-md hover:shadow-lg transition-all duration-300 hover:translate-y-[-3px] border border-white/20 dark:border-white/10"
              >
                <div className="w-12 h-12 rounded-xl bg-violet-500 text-white flex items-center justify-center mx-auto mb-4 shadow-md shadow-violet-500/20 dark:shadow-black/20">
                  <Icon className="w-6 h-6" />
                </div>
                <p className="text-2xl sm:text-3xl font-extrabold text-[#181126] dark:text-white mb-1">
                  {stat.value}
                </p>
                <p className="text-sm font-semibold text-violet-700 dark:text-violet-300 mb-2">
                  {stat.label}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                  {stat.description}
                </p>
              </div>
            );
          })}
        </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
