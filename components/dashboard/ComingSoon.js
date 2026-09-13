export function ComingSoon({ title, description, icon: Icon }) {
  return (
    <div className="glass-panel rounded-2xl border border-white/60 dark:border-white/20 shadow-lg p-8 sm:p-10 flex flex-col items-center text-center">
      <div className="w-12 h-12 rounded-xl bg-violet-100 dark:bg-violet-500/15 border border-violet-200 dark:border-violet-500/25 text-violet-600 dark:text-violet-300 flex items-center justify-center">
        {Icon ? <Icon className="w-6 h-6" /> : null}
      </div>
      <span className="mt-4 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25">
        Segera Hadir
      </span>
      <h1 className="mt-3 text-xl sm:text-2xl font-extrabold tracking-tight text-[#181126] dark:text-white">{title}</h1>
      <p className="mt-2 max-w-md text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{description}</p>
    </div>
  );
}
