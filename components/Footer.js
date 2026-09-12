"use client";

import { ShieldCheck, Heart } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-violet-100 dark:border-purple-900/40 bg-white/50 dark:bg-purple-950/20 backdrop-blur-sm py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-gray-100 dark:border-purple-900/40">
          {/* Brand Info */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center text-white shadow-sm shadow-violet-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-lg font-bold text-gray-900 dark:text-white">
                Trust<span className="text-violet-600 dark:text-violet-400">Bon</span>
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Sistem Informasi Manajemen Piutang UMKM Multi-Tenant
              </p>
            </div>
          </div>

          {/* Quick links */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-gray-600 dark:text-gray-300 font-medium">
            <a href="#masalah" className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors">
              Masalah
            </a>
            <a href="#fitur" className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors">
              Fitur Utama
            </a>
            <a href="#simulasi" className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors">
              Simulasi Skor
            </a>
            <a href="#cara-kerja" className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors">
              Cara Kerja
            </a>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] font-semibold border border-emerald-300 dark:border-emerald-800">
              Sistem Aktif & Terlindungi
            </span>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400 text-center sm:text-left">
          <p>© {new Date().getFullYear()} TrustBon. Solusi cerdas piutang & kasbon untuk UMKM Indonesia.</p>
          <p className="flex items-center gap-1 justify-center">
            Dibuat untuk memajukan perekonomian warung & toko ritel
          </p>
        </div>
      </div>
    </footer>
  );
}
