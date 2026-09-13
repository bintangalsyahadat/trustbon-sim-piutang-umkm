"use client";

import { useRef, useState } from "react";
import { Copy, Check } from "lucide-react";

/**
 * Prominent invite-code display with a copy button.
 * Baseline: the code is always selectable (select-all). Clicking "Salin"
 * uses the Clipboard API; when unavailable/denied it falls back to
 * selecting the code text so the owner can copy it manually.
 */
export function InviteCodeCopy({ code }) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef(null);
  const timerRef = useRef(null);

  function selectCodeText() {
    const el = codeRef.current;
    if (!el) return;
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  async function handleCopy() {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(code);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Graceful fallback: highlight the code for manual copying (Ctrl+C).
      selectCodeText();
    }
  }

  return (
    <div className="flex items-center gap-2.5 shrink-0">
      <code
        ref={codeRef}
        className="px-3.5 py-2 rounded-lg bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/25 text-base sm:text-lg font-mono font-bold tracking-widest text-violet-700 dark:text-violet-300 select-all"
      >
        {code}
      </code>
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Salin kode undangan"
        className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1a1625] ${
          copied
            ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/30 dark:shadow-black/30"
            : "bg-violet-500 hover:bg-violet-600 text-white shadow-violet-500/30 dark:shadow-black/30"
        }`}
      >
        {copied ? (
          <Check className="w-3.5 h-3.5" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
        <span aria-live="polite">{copied ? "Tersalin" : "Salin"}</span>
      </button>
    </div>
  );
}
