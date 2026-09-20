export default function PembayaranLoading() {
  return (
    <div role="status" aria-label="Memuat pembayaran" className="max-w-6xl mx-auto animate-fadeIn space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-36 rounded-lg bg-gray-200/70 dark:bg-white/10 animate-pulse" />
          <div className="h-4 w-48 rounded-md bg-gray-200/70 dark:bg-white/10 animate-pulse" />
        </div>
        <div className="h-10 w-36 rounded-lg bg-gray-200/70 dark:bg-white/10 animate-pulse" />
      </div>

      {/* Summary card */}
      <div className="glass-card rounded-2xl p-5 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
              <div className="h-7 w-32 rounded-lg bg-gray-200/70 dark:bg-white/10 animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-white/20 dark:border-white/10">
          <div className="h-5 w-40 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
        </div>
        <div className="divide-y divide-white/20 dark:divide-white/10">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="px-5 sm:px-6 py-3.5 flex items-center gap-4">
              <div className="h-4 flex-1 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
              <div className="h-4 w-20 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
              <div className="h-4 w-24 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
              <div className="h-4 w-16 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
