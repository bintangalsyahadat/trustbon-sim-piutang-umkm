export default function ProfilLoading() {
  return (
    <div role="status" aria-label="Memuat profil" className="max-w-5xl mx-auto animate-fadeIn space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-28 rounded-lg bg-gray-200/70 dark:bg-white/10 animate-pulse" />
        <div className="h-4 w-44 rounded-md bg-gray-200/70 dark:bg-white/10 animate-pulse" />
      </div>
      <div className="glass-card rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="h-5 w-32 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-3.5 w-20 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
            <div className="h-10 w-full rounded-lg bg-gray-200/70 dark:bg-white/10 animate-pulse" />
          </div>
        ))}
        <div className="h-9 w-24 rounded-lg bg-gray-200/70 dark:bg-white/10 animate-pulse" />
      </div>
      <div className="glass-card rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="h-5 w-40 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-3.5 w-28 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
            <div className="h-10 w-full rounded-lg bg-gray-200/70 dark:bg-white/10 animate-pulse" />
          </div>
        ))}
        <div className="h-9 w-36 rounded-lg bg-gray-200/70 dark:bg-white/10 animate-pulse" />
      </div>
    </div>
  );
}
