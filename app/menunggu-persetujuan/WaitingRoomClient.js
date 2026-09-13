"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2 } from "lucide-react";
import { getMyMembershipStatus } from "@/app/actions/members";

const POLL_INTERVAL_MS = 10_000;

/**
 * Polls the DB membership status while the waiting room is open. On
 * "active" the user goes to the dashboard; on "rejected" the page
 * re-renders into the rejected state; a missing session goes to /login.
 * The interval is cleared on unmount.
 */
export function StatusPoller() {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await getMyMembershipStatus();
        if (res?.status === "active") {
          router.push("/dashboard");
          router.refresh();
        } else if (res?.status === "rejected") {
          router.refresh();
        } else if (res?.status === null) {
          router.push("/login");
          router.refresh();
        }
      } catch {
        // Transient failure — the next interval retries.
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [router]);

  return null;
}

/** Manual re-check: re-renders the server component, which redirects when approved. */
export function CheckStatusButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
      className="w-full py-2.5 px-4 rounded-lg border border-violet-200 dark:border-violet-500/20 bg-white/70 dark:bg-white/5 text-violet-900 dark:text-violet-200 font-semibold text-sm hover:bg-violet-50 dark:hover:bg-violet-500/10 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1a1625]"
    >
      {pending ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <RefreshCw className="w-4 h-4" />
      )}
      <span>{pending ? "Memeriksa…" : "Cek Status"}</span>
    </button>
  );
}
