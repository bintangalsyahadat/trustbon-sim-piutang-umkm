export default function TransaksiLoading() {
  return (
    <div role="status" aria-label="Memuat transaksi" className="max-w-6xl mx-auto animate-fadeIn space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-36 rounded-lg bg-gray-200/70 dark:bg-white/10 animate-pulse" />
          <div className="h-4 w-52 rounded-md bg-gray-200/70 dark:bg-white/10 animate-pulse" />
        </div>
        <div className="h-10 w-40 rounded-lg bg-gray-200/70 dark:bg-white/10 animate-pulse" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="glass-card rounded-2xl p-5 space-y-3">
            <div className="h-4 w-28 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
            <div className="h-8 w-24 rounded-lg bg-gray-200/70 dark:bg-white/10 animate-pulse" />
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-white/20 dark:border-white/10">
          <div className="h-5 w-36 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
        </div>
        <div className="divide-y divide-white/20 dark:divide-white/10">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="px-5 sm:px-6 py-3.5 flex items-center gap-4">
              <div className="h-4 flex-1 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
              <div className="h-4 w-24 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
              <div className="h-4 w-20 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
              <div className="h-4 w-16 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
