"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, Sparkles } from "lucide-react";
import { InsightCard } from "@/components/dashboard/InsightCard";

/**
 * Skeleton pulse bar matching the InsightCard layout.
 */
function InsightSkeleton() {
  return (
    <div className="glass-card rounded-2xl border border-white/40 dark:border-white/10 shadow-md p-5 sm:p-6 flex items-start gap-3.5 animate-pulse">
      <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-500/15 border border-violet-200 dark:border-violet-500/25 shrink-0" />
      <div className="flex-1 space-y-2.5">
        <div className="h-3 bg-gray-200/70 dark:bg-white/10 rounded-lg w-full" />
        <div className="h-3 bg-gray-200/70 dark:bg-white/10 rounded-lg w-4/5" />
        <div className="h-3 bg-gray-200/70 dark:bg-white/10 rounded-lg w-2/3" />
      </div>
    </div>
  );
}

/**
 * Client-side insight section: fetches the LLM-generated insight from
 * /api/insight on mount, shows a glassmorphism loading skeleton while
 * waiting, and renders the result in an InsightCard.
 *
 * Falls back to a static message if the API returns an error or the
 * LLM is unavailable.
 */
export function InsightSection() {
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchInsight() {
      try {
        const res = await fetch("/api/insight");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) {
          setInsight(json.insight ?? null);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    }

    fetchInsight();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-5">
        <InsightSkeleton />
        <InsightSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-5">
        <InsightCard>
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              Insight belum bisa dimuat saat ini. Coba refresh halaman.
            </span>
          </span>
        </InsightCard>
      </div>
    );
  }

  return (
    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-5">
      <InsightCard>{insight}</InsightCard>
    </div>
  );
}
