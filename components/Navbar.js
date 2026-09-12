"use client";

import { useState, useEffect } from "react";
import { 
  ShieldCheck, 
  Menu, 
  X, 
  ArrowRight
} from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

export function Navbar({ onOpenLogin, onOpenRegister }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 15) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      id="main-navbar"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        isScrolled
          ? "bg-white/95 dark:bg-[#0d0914]/95 backdrop-blur-md shadow-md shadow-purple-950/5 py-3 border-b border-violet-100 dark:border-purple-900/60"
          : "bg-white/90 dark:bg-[#0d0914]/90 backdrop-blur-sm py-4 border-b border-violet-100/60 dark:border-purple-900/30"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Brand Logo */}
        <a
          href="#"
          id="nav-logo"
          className="flex items-center gap-2.5 group focus:outline-none"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center text-white shadow-md shadow-violet-500/25 group-hover:scale-105 transition-transform">
            <ShieldCheck className="w-5 h-5 text-violet-100" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-violet-700 via-purple-700 to-indigo-700 dark:from-violet-400 dark:via-purple-300 dark:to-indigo-300 bg-clip-text text-transparent">
                TrustBon
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-violet-100 dark:bg-purple-900/60 text-violet-800 dark:text-violet-300 border border-violet-200 dark:border-purple-700/60">
                UMKM
              </span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium tracking-tight -mt-0.5">
              Skor Risiko Piutang Kasbon
            </p>
          </div>
        </a>

        {/* Navigation Desktop Links */}
        <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-gray-600 dark:text-gray-300">
          <a
            href="#masalah"
            id="nav-link-masalah"
            className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
          >
            Masalah UMKM
          </a>
          <a
            href="#fitur"
            id="nav-link-fitur"
            className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
          >
            Fitur Unggulan
          </a>
          <a
            href="#simulasi"
            id="nav-link-simulasi"
            className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors flex items-center gap-1.5"
          >
            Simulasi Skor
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </a>
          <a
            href="#cara-kerja"
            id="nav-link-cara-kerja"
            className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
          >
            Cara Kerja
          </a>
        </nav>

        {/* Actions Desktop */}
        <div className="hidden md:flex items-center gap-3">
          <ThemeToggle id="nav-theme-toggle" />
          <button
            id="btn-nav-masuk"
            type="button"
            onClick={() => onOpenLogin && onOpenLogin()}
            className="px-4 py-2 text-sm font-semibold rounded-lg text-violet-900 dark:text-violet-200 hover:bg-violet-100/60 dark:hover:bg-purple-900/40 transition-colors cursor-pointer"
          >
            Masuk
          </button>
          <button
            id="btn-nav-daftar"
            type="button"
            onClick={() => onOpenRegister && onOpenRegister()}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-600/25 transition-all flex items-center gap-1.5 hover:translate-y-[-1px] active:translate-y-[0px] cursor-pointer"
          >
            <span>Daftar Gratis</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Mobile controls */}
        <div className="flex md:hidden items-center gap-2">
          <ThemeToggle id="mobile-theme-toggle" />
          <button
            id="btn-mobile-menu-toggle"
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-purple-950/60 focus:outline-none cursor-pointer"
            aria-label="Buka menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {mobileMenuOpen && (
        <div
          id="mobile-nav-menu"
          className="md:hidden glass-panel border-b border-violet-100 dark:border-purple-900/50 px-4 pt-3 pb-6 space-y-3 mt-2"
        >
          <a
            href="#masalah"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-violet-50 dark:hover:bg-purple-950/80"
          >
            Masalah yang Diselesaikan
          </a>
          <a
            href="#fitur"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-violet-50 dark:hover:bg-purple-950/80"
          >
            Fitur Utama
          </a>
          <a
            href="#simulasi"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-violet-50 dark:hover:bg-purple-950/80"
          >
            Simulasi Skor Risiko
          </a>
          <a
            href="#cara-kerja"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-violet-50 dark:hover:bg-purple-950/80"
          >
            Cara Kerja
          </a>
          <div className="pt-2 border-t border-violet-100 dark:border-purple-900/40 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenLogin && onOpenLogin();
              }}
              className="w-full text-center py-2.5 text-sm font-semibold rounded-lg text-violet-900 dark:text-violet-200 border border-violet-200 dark:border-purple-800 bg-white/60 dark:bg-purple-950/40 cursor-pointer"
            >
              Masuk ke Akun
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenRegister && onOpenRegister();
              }}
              className="w-full text-center py-2.5 text-sm font-semibold rounded-lg bg-violet-600 text-white shadow-md shadow-violet-600/30 cursor-pointer"
            >
              Daftar Bisnis Gratis
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
