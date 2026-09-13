import { Sparkles } from "lucide-react";

/**
 * Violet-accent glass card for narrative insights. Reads as a sentence —
 * pass the copy as `children` (preferred) or via the `text` prop.
 */
export function InsightCard({ children, text }) {
  return (
    <div className="glass-card rounded-2xl border border-white/40 dark:border-white/10 shadow-md p-5 sm:p-6 flex items-start gap-3.5">
      <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-500/15 border border-violet-200 dark:border-violet-500/25 text-violet-600 dark:text-violet-300 flex items-center justify-center shrink-0">
        <Sparkles className="w-4.5 h-4.5" />
      </div>
      <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">
        {children ?? text}
      </p>
    </div>
  );
}
