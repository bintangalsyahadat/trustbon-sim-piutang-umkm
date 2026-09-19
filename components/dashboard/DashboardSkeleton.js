/**
 * Loading skeleton for the role-based dashboards (/dashboard).
 * Used as Suspense fallback while the async server component fetches
 * real data from the DB. Server-compatible (no client hooks).
 *
 * Mirrors the StatCard / SectionHeading / table rhythm of both
 * CashierDashboard and OwnerDashboard so the swap is seamless.
 */
export function DashboardSkeleton() {
  return (
    <div
      className="max-w-6xl mx-auto animate-fadeIn"
      role="status"
      aria-label="Memuat data dashboard"
    >
      {/* Header: title + subtitle + action button placeholder */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-3">
          <div className="h-8 w-48 rounded-lg bg-gray-200/70 dark:bg-white/10 animate-pulse" />
          <div className="h-4 w-64 rounded-lg bg-gray-200/70 dark:bg-white/10 animate-pulse" />
        </div>
        <div className="h-11 w-44 rounded-xl bg-gray-200/70 dark:bg-white/10 animate-pulse" />
      </div>

      {/* Metric cards */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={`skeleton-card-${i}`}
            className="glass-card rounded-2xl border border-white/40 dark:border-white/10 shadow-md p-5 sm:p-6 flex flex-col"
          >
            <div className="w-11 h-11 rounded-xl bg-gray-200/70 dark:bg-white/10 animate-pulse" />
            <div className="mt-4 h-3 w-24 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
            <div className="mt-2 h-7 w-20 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
            <div className="mt-2 h-3 w-32 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
          </div>
        ))}
      </div>

      {/* Section heading placeholder */}
      <div className="mt-10 space-y-2">
        <div className="h-5 w-40 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
        <div className="h-3 w-64 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
      </div>

      {/* Table placeholder */}
      <div className="mt-4 glass-panel rounded-2xl border border-white/60 dark:border-white/20 shadow-lg overflow-hidden">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-gray-200/70 dark:border-white/10 text-left">
              {[0, 1, 2, 3].map((i) => (
                <th
                  key={`skeleton-th-${i}`}
                  scope="col"
                  className="px-5 sm:px-6 py-3.5"
                >
                  <div className="h-3 w-16 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2, 3, 4].map((i) => (
              <tr
                key={`skeleton-row-${i}`}
                className="border-b border-gray-100/80 dark:border-white/5 last:border-b-0"
              >
                {[0, 1, 2, 3].map((j) => (
                  <td
                    key={`skeleton-td-${i}-${j}`}
                    className="px-5 sm:px-6 py-3.5"
                  >
                    <div className="h-4 rounded bg-gray-200/70 dark:bg-white/10 animate-pulse" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <span className="sr-only">Memuat data dashboard…</span>
    </div>
  );
}
