"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2 } from "lucide-react";
import { approveMember, rejectMember } from "@/app/actions/members";
import { AuthError } from "@/components/AuthUi";
import { ConfirmDialog } from "@/components/ConfirmDialog";

/**
 * Per-row approve/reject controls for a pending join request. Both actions are
 * confirmed through the shared `ConfirmDialog`; the row disappears after a
 * successful review (server action revalidates and we refresh), so errors are
 * shown inline here.
 */
export function MemberReviewActions({ userId, userName }) {
  const router = useRouter();
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [pending, startTransition] = useTransition();

  function review(decision) {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const res =
        decision === "approve"
          ? await approveMember(userId)
          : await rejectMember(userId);
      setConfirming(null);
      if (res?.ok) {
        router.refresh();
      } else {
        setError(res?.error ?? "Tindakan gagal. Silakan coba lagi.");
      }
    });
  }

  function close() {
    if (pending) return;
    setConfirming(null);
  }

  const approving = confirming === "approve";

  return (
    <div className="shrink-0 sm:text-right">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming("approve")}
          aria-label={`Setujui ${userName}`}
          className="px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold shadow-md shadow-emerald-500/30 dark:shadow-black/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1a1625]"
        >
          {pending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Check className="w-3.5 h-3.5" />
          )}
          <span>Setujui</span>
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming("reject")}
          aria-label={`Tolak ${userName}`}
          className="px-3.5 py-2 rounded-lg border border-rose-200 dark:border-rose-500/25 bg-white/70 dark:bg-white/5 text-rose-600 dark:text-rose-300 text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1a1625]"
        >
          <X className="w-3.5 h-3.5" />
          <span>Tolak</span>
        </button>
      </div>
      {error ? (
        <div className="mt-2 sm:ml-auto sm:max-w-xs text-left">
          <AuthError message={error} />
        </div>
      ) : null}

      <ConfirmDialog
        open={confirming !== null}
        title={approving ? "Setujui permintaan?" : "Tolak permintaan?"}
        description={
          approving ? (
            <>
              <strong>{userName}</strong> akan bergabung ke bisnis ini dan bisa
              melihat data di dalamnya.
            </>
          ) : (
            <>
              Permintaan <strong>{userName}</strong> akan ditolak dan tidak bisa
              dikembalikan dari halaman ini.
            </>
          )
        }
        onDismiss={close}
        dismissible={!pending}
        actions={[
          { label: "Batal", tone: "neutral", onClick: close },
          {
            label: approving ? "Setujui" : "Tolak",
            tone: approving ? "primary" : "danger",
            loading: pending,
            onClick: () => review(approving ? "approve" : "reject"),
          },
        ]}
      />
    </div>
  );
}
