"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Sun, Moon } from "lucide-react";

const emptySubscribe = () => () => {};

export function ThemeToggle({ id = "theme-toggle-btn" }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const isDark = mounted ? resolvedTheme === "dark" : false;

  const handleToggle = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <button
      id={id}
      type="button"
      onClick={handleToggle}
      className="relative z-10 flex items-center justify-center w-9 h-9 rounded-lg border border-violet-200/80 dark:border-purple-800/80 bg-white dark:bg-purple-950/80 hover:bg-violet-50 dark:hover:bg-purple-900 text-violet-700 dark:text-violet-300 transition-colors shadow-sm cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-violet-500/40"
      aria-label={isDark ? "Beralih ke mode terang" : "Beralih ke mode gelap"}
      title={isDark ? "Beralih ke mode terang" : "Beralih ke mode gelap"}
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-amber-400 pointer-events-none transition-transform duration-200" />
      ) : (
        <Moon className="w-4 h-4 text-violet-700 dark:text-violet-300 pointer-events-none transition-transform duration-200" />
      )}
    </button>
  );
}
