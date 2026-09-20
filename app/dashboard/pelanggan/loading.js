export default function PelangganLoading() {
  return (
    <div role="status" aria-label="Memuat pelanggan" className="max-w-6xl mx-auto animate-fadeIn space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-40 rounded-lg bg-gray-200/70 dark:bg-white/10 animate-pulse" />
          <div className="h-4 w-56 rounded-md bg-gray-200/70 dark:bg-white/10 animate-pulse" />
        </div>
        <div className="h-10 w-36 rounded-lg bg-gray-200/70 dark:bg-white/10 animate-pulse" />
      </div>

      {/* Search bar */}
      <div className="h-10 w-full rounded-lg bg-gray-200/70 dark:bg-white/10 animate-pulse" />

      {/* Table */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="px-5 sm:px-6 py-3 border-b border-white/20 dark:border-white/10">
          <div className="flex gap-8">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-4 flex-1 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
            ))}
          </div>
        </div>
        <div className="divide-y divide-white/20 dark:divide-white/10">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="px-5 sm:px-6 py-3.5 flex items-center gap-4">
              <div className="h-4 flex-1 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
              <div className="h-4 w-24 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
              <div className="h-4 w-20 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
              <div className="h-4 w-16 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
              <div className="h-4 w-16 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
