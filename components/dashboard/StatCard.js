/**
 * Single glass metric card: violet icon chip, small-caps label, large value
 * and an optional hint line. `value` arrives preformatted (formatIDR, …);
 * `icon` is a lucide-react component.
 */
export function StatCard({ icon: Icon, label, value, hint }) {
  return (
    <div className="glass-card rounded-2xl border border-white/40 dark:border-white/10 shadow-md p-5 sm:p-6 flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="w-11 h-11 rounded-xl bg-violet-100 dark:bg-violet-500/15 border border-violet-200 dark:border-violet-500/25 text-violet-600 dark:text-violet-300 flex items-center justify-center">
        {Icon ? <Icon className="w-5 h-5" /> : null}
      </div>
      <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight tabular-nums text-[#181126] dark:text-white">
        {value}
      </p>
      {hint ? (
        <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
