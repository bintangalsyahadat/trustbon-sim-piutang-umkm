"use client";

import { useSyncExternalStore } from "react";
import { ArrowUp } from "lucide-react";

function getSnapshot() {
  return typeof window !== "undefined" ? window.scrollY : 0;
}

function subscribe(callback) {
  window.addEventListener("scroll", callback, { passive: true });
  return () => window.removeEventListener("scroll", callback);
}

export function ScrollToTop() {
  const scrollTop = useSyncExternalStore(subscribe, getSnapshot, () => 0);
  const visible = scrollTop > 400;

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Kembali ke atas"
      className="fixed bottom-20 right-6 z-40 w-10 h-10 rounded-full bg-violet-500/80 hover:bg-violet-600 text-white shadow-lg shadow-violet-500/30 backdrop-blur-sm flex items-center justify-center transition-all duration-300 hover:scale-110"
    >
      <ArrowUp className="w-4 h-4" />
    </button>
  );
}
