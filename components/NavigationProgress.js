"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname } from "next/navigation";

/**
 * Thin animated progress bar at the top of the viewport during route transitions.
 * Uses useTransition to track React navigation state and a manual timer for
 * the initial server-render gap before the client hydrates the new page.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  // Track pathname changes via transition
  useEffect(() => {
    startTransition(() => {});
  }, [pathname, startTransition]);

  // Animate progress bar
  useEffect(() => {
    if (isPending) {
      setVisible(true);
      setProgress(0);
      const t1 = setTimeout(() => setProgress(30), 50);
      const t2 = setTimeout(() => setProgress(60), 300);
      const t3 = setTimeout(() => setProgress(80), 800);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }
    // Transition finished — fill to 100% then hide
    setProgress(100);
    const t = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 300);
    return () => clearTimeout(t);
  }, [isPending]);

  if (!visible && progress === 0) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] h-[3px] bg-transparent pointer-events-none"
      aria-hidden="true"
    >
      <div
        className="h-full bg-gradient-to-r from-violet-500 via-purple-500 to-violet-400 rounded-full transition-all duration-300 ease-out shadow-[0_0_8px_rgba(139,92,246,0.5)]"
        style={{
          width: `${progress}%`,
          opacity: progress > 0 ? 1 : 0,
        }}
      />
    </div>
  );
}
