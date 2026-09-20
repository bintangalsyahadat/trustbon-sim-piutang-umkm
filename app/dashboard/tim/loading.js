export default function TimLoading() {
  return (
    <div role="status" aria-label="Memuat tim" className="max-w-6xl mx-auto animate-fadeIn space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-24 rounded-lg bg-gray-200/70 dark:bg-white/10 animate-pulse" />
        <div className="h-4 w-48 rounded-md bg-gray-200/70 dark:bg-white/10 animate-pulse" />
      </div>
      <div className="glass-card rounded-2xl p-5 sm:p-6 space-y-3">
        <div className="h-5 w-28 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
        <div className="flex items-center gap-3">
          <div className="h-10 flex-1 rounded-lg bg-gray-200/70 dark:bg-white/10 animate-pulse" />
          <div className="h-10 w-20 rounded-lg bg-gray-200/70 dark:bg-white/10 animate-pulse" />
        </div>
      </div>
      <div className="glass-card rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="h-5 w-32 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-3 border-t border-white/20 dark:border-white/10">
            <div className="h-9 w-9 rounded-full bg-gray-200/70 dark:bg-white/10 animate-pulse" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-28 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
              <div className="h-3 w-16 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
            </div>
            <div className="h-7 w-16 rounded-full bg-gray-200/70 dark:bg-white/10 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
