"use client";

import { useState, useMemo } from "react";
import { Gauge, Sparkles, RefreshCw, AlertCircle, CheckCircle2, AlertTriangle, ShieldX } from "lucide-react";

export function ScoreSimulator() {
  // Simulator inputs
  const [daysLate, setDaysLate] = useState(0);
  const [repaymentRate, setRepaymentRate] = useState(100);
  const [lateHistoryCount, setLateHistoryCount] = useState(0);

  // Calculate score and status rule-based
  const { score, status, badgeStyle, recommendation, category } = useMemo(() => {
    // Base score 100
    let calc = 100;

    // Penalty for current days late
    if (daysLate > 0) {
      calc -= Math.min(daysLate * 1.6, 45);
    }

    // Impact of repayment rate (e.g. partial payment)
    const unpaidRatio = (100 - repaymentRate) / 100;
    calc -= unpaidRatio * 35;

    // Penalty for repeated late history
    calc -= lateHistoryCount * 8;

    // Constrain to 0 - 100
    const finalScore = Math.max(5, Math.min(99, Math.round(calc)));

    if (finalScore >= 70) {
      return {
        score: finalScore,
        status: "stable",
        category: "Stable (Aman)",
        badgeStyle: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800",
        recommendation:
          "Pelanggan sangat terpercaya dan konsisten melunasi tepat waktu. Aman untuk disetujui kasbon baru, layak dipertimbangkan untuk kenaikan limit kredit.",
      };
    } else if (finalScore >= 40) {
      return {
        score: finalScore,
        status: "recovering",
        category: "Recovering (Waspada Sedang)",
        badgeStyle: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800",
        recommendation:
          "Pernah memiliki riwayat terlambat atau cicilan parsial. Terapkan pembatasan limit kasbon baru, jadwalkan reminder WhatsApp ramah pada H-2 jatuh tempo.",
      };
    } else {
      return {
        score: finalScore,
        status: "at_risk",
        category: "At Risk (Bahaya)",
        badgeStyle: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-800",
        recommendation:
          "Tingkat risiko tinggi dengan riwayat nunggak signifikan. Hentikan kasbon baru, wajibkan persetujuan Owner untuk setiap pengecualian, dan prioritaskan penagihan intensif.",
      };
    }
  }, [daysLate, repaymentRate, lateHistoryCount]);

  const setPreset = (type) => {
    if (type === "good") {
      setDaysLate(0);
      setRepaymentRate(100);
      setLateHistoryCount(0);
    } else if (type === "moderate") {
      setDaysLate(7);
      setRepaymentRate(60);
      setLateHistoryCount(2);
    } else {
      setDaysLate(28);
      setRepaymentRate(20);
      setLateHistoryCount(5);
    }
  };

  return (
    <section id="simulasi" className="py-20 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-100 dark:bg-purple-950/70 border border-violet-200 dark:border-purple-800 text-violet-700 dark:text-violet-300 text-xs font-semibold">
            <Gauge className="w-3.5 h-3.5" />
            <span>Simulasi Interaktif</span>
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#181126] dark:text-white tracking-tight">
            Uji Coba Algoritma Skoring Risiko Kredit
          </h2>
          <p className="text-gray-600 dark:text-gray-300 text-sm sm:text-base leading-relaxed">
            Geser parameter di bawah ini untuk melihat bagaimana TrustBon secara cerdas menilai kelayakan kasbon pelanggan Anda dan memberikan rekomendasi tindakan.
          </p>
        </div>

        {/* Simulator Card Container */}
        <div className="glass-card rounded-2xl p-6 sm:p-8 lg:p-10 max-w-4xl mx-auto shadow-xl border border-white/60 dark:border-purple-800/40">
          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-6 mb-6 border-b border-gray-200/60 dark:border-purple-900/50">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
              Pilih Skenario Contoh:
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPreset("good")}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition-colors"
              >
                Pelanggan Teladan
              </button>
              <button
                type="button"
                onClick={() => setPreset("moderate")}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 transition-colors"
              >
                Mulai Menunggak
              </button>
              <button
                type="button"
                onClick={() => setPreset("bad")}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition-colors"
              >
                Macet Berat
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            {/* Left Column: Sliders */}
            <div className="md:col-span-7 space-y-6">
              {/* Slider 1: Days Overdue */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <label htmlFor="slider-days-late" className="text-gray-700 dark:text-gray-300">
                    Keterlambatan Jatuh Tempo:
                  </label>
                  <span className="text-violet-700 dark:text-violet-300 font-bold">
                    {daysLate === 0 ? "Tepat Waktu (0 Hari)" : `${daysLate} Hari Terlambat`}
                  </span>
                </div>
                <input
                  id="slider-days-late"
                  type="range"
                  min="0"
                  max="45"
                  value={daysLate}
                  onChange={(e) => setDaysLate(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 dark:bg-purple-950 rounded-lg appearance-none cursor-pointer accent-violet-600"
                />
                <div className="flex justify-between text-[10px] text-gray-700 dark:text-gray-300">
                  <span>0 Hari (Lancar)</span>
                  <span>15 Hari</span>
                  <span>30 Hari</span>
                  <span>45+ Hari</span>
                </div>
              </div>

              {/* Slider 2: Repayment Completion Rate */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <label htmlFor="slider-repayment" className="text-gray-700 dark:text-gray-300">
                    Persentase Pelunasan Kasbon Terakhir:
                  </label>
                  <span className="text-violet-700 dark:text-violet-300 font-bold">
                    {repaymentRate}% Lunas
                  </span>
                </div>
                <input
                  id="slider-repayment"
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={repaymentRate}
                  onChange={(e) => setRepaymentRate(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 dark:bg-purple-950 rounded-lg appearance-none cursor-pointer accent-violet-600"
                />
                <div className="flex justify-between text-[10px] text-gray-700 dark:text-gray-300">
                  <span>0% (Belum Bayar)</span>
                  <span>50% (Parsial)</span>
                  <span>100% (Lunas Total)</span>
                </div>
              </div>

              {/* Slider 3: Late History Count */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <label htmlFor="slider-late-history" className="text-gray-700 dark:text-gray-300">
                    Frekuensi Telat dalam 6 Bulan Terakhir:
                  </label>
                  <span className="text-violet-700 dark:text-violet-300 font-bold">
                    {lateHistoryCount} Kali
                  </span>
                </div>
                <input
                  id="slider-late-history"
                  type="range"
                  min="0"
                  max="8"
                  value={lateHistoryCount}
                  onChange={(e) => setLateHistoryCount(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 dark:bg-purple-950 rounded-lg appearance-none cursor-pointer accent-violet-600"
                />
                <div className="flex justify-between text-[10px] text-gray-700 dark:text-gray-300">
                  <span>0 Kali (Disiplin)</span>
                  <span>4 Kali</span>
                  <span>8+ Kali (Sering Mangkir)</span>
                </div>
              </div>
            </div>

            {/* Right Column: Score Gauge & Recommendation */}
            <div className="md:col-span-5 p-5 rounded-xl bg-violet-50/60 dark:bg-purple-950/40 border border-violet-100 dark:border-purple-800/40 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Hasil Kalkulasi TrustBon:
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${badgeStyle}`}>
                  {status}
                </span>
              </div>

              {/* Score Display */}
              <div className="flex items-center gap-4 py-2">
                <div
                  className={`w-20 h-20 rounded-2xl flex flex-col items-center justify-center text-white shadow-lg ${
                    status === "stable"
                      ? "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/20"
                      : status === "recovering"
                      ? "bg-gradient-to-br from-amber-500 to-yellow-600 shadow-amber-500/20"
                      : "bg-gradient-to-br from-rose-500 to-red-600 shadow-rose-500/20"
                  }`}
                >
                  <span className="text-3xl font-extrabold leading-none">{score}</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider opacity-90">
                    / 100
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400 block">Kategori Risiko:</span>
                  <h4 className="text-base font-bold text-gray-900 dark:text-white leading-tight">
                    {category}
                  </h4>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Berdasarkan model skoring rule-based TrustBon
                  </p>
                </div>
              </div>

              {/* Recommendation Box */}
              <div className="pt-2 border-t border-violet-200/60 dark:border-purple-900/50">
                <span className="text-[11px] font-bold text-violet-950 dark:text-violet-200 block mb-1">
                  Rekomendasi Kebijakan Toko:
                </span>
                <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed bg-white/70 dark:bg-purple-950/80 p-2.5 rounded-lg border border-violet-100 dark:border-purple-800/40">
                  {recommendation}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
