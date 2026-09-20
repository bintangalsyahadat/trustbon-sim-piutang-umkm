export default function LaporanLoading() {
  return (
    <div role="status" aria-label="Memuat laporan" className="max-w-6xl mx-auto animate-fadeIn space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-28 rounded-lg bg-gray-200/70 dark:bg-white/10 animate-pulse" />
        <div className="h-4 w-56 rounded-md bg-gray-200/70 dark:bg-white/10 animate-pulse" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass-card rounded-2xl p-5 space-y-3">
            <div className="h-4 w-24 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
            <div className="h-8 w-28 rounded-lg bg-gray-200/70 dark:bg-white/10 animate-pulse" />
          </div>
        ))}
      </div>
      <div className="glass-card rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="h-5 w-40 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-gray-200/70 dark:bg-white/10 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
