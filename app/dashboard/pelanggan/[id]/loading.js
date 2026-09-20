export default function PelangganDetailLoading() {
  return (
    <div role="status" aria-label="Memuat detail pelanggan" className="max-w-6xl mx-auto animate-fadeIn space-y-6">
      {/* Profile header */}
      <div className="glass-card rounded-2xl p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-gray-200/70 dark:bg-white/10 animate-pulse" />
          <div className="space-y-2 flex-1">
            <div className="h-6 w-48 rounded-lg bg-gray-200/70 dark:bg-white/10 animate-pulse" />
            <div className="h-4 w-32 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
          </div>
          <div className="h-9 w-24 rounded-lg bg-gray-200/70 dark:bg-white/10 animate-pulse" />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass-card rounded-2xl p-5 space-y-3">
            <div className="h-4 w-20 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
            <div className="h-7 w-24 rounded-lg bg-gray-200/70 dark:bg-white/10 animate-pulse" />
          </div>
        ))}
      </div>

      {/* Section cards */}
      {[...Array(2)].map((_, s) => (
        <div key={s} className="glass-card rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="h-5 w-36 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-2">
                <div className="h-4 flex-1 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
                <div className="h-4 w-20 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
                <div className="h-4 w-24 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
