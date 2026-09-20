export default function NotifikasiLoading() {
  return (
    <div role="status" aria-label="Memuat notifikasi" className="max-w-3xl mx-auto animate-fadeIn space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-32 rounded-lg bg-gray-200/70 dark:bg-white/10 animate-pulse" />
        <div className="h-4 w-48 rounded-md bg-gray-200/70 dark:bg-white/10 animate-pulse" />
      </div>
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="glass-card rounded-xl p-4 flex items-start gap-3">
            <div className="h-9 w-9 rounded-full bg-gray-200/70 dark:bg-white/10 animate-pulse shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
              <div className="h-3 w-1/2 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
            </div>
            <div className="h-3 w-12 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
