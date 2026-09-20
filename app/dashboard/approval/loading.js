export default function ApprovalLoading() {
  return (
    <div role="status" aria-label="Memuat approval" className="max-w-6xl mx-auto animate-fadeIn space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-7 w-44 rounded-lg bg-gray-200/70 dark:bg-white/10 animate-pulse" />
        <div className="h-4 w-60 rounded-md bg-gray-200/70 dark:bg-white/10 animate-pulse" />
      </div>

      {/* Card list */}
      {[...Array(3)].map((_, i) => (
        <div key={i} className="glass-card rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gray-200/70 dark:bg-white/10 animate-pulse" />
              <div className="space-y-2">
                <div className="h-4 w-32 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
                <div className="h-3 w-24 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="h-9 w-20 rounded-lg bg-gray-200/70 dark:bg-white/10 animate-pulse" />
              <div className="h-9 w-20 rounded-lg bg-gray-200/70 dark:bg-white/10 animate-pulse" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, j) => (
              <div key={j} className="space-y-1">
                <div className="h-3 w-16 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
                <div className="h-5 w-20 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
