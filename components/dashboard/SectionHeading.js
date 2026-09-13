/**
 * Section header for dashboard blocks: bold title, optional muted
 * description and an optional right-aligned action node (link/button).
 */
export function SectionHeading({ title, description, action }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-[#181126] dark:text-white">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
