"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { KeyRound, ArrowRight, ArrowLeft, Loader2 } from "lucide-react";
import { completeJoinOnboarding } from "@/app/actions/auth";
import { resubmitJoinAsCashier } from "@/app/actions/onboarding-resume";
import {
  AuthError,
  authInputClass,
  authLabelClass,
  authPrimaryButtonClass,
} from "@/components/AuthUi";

/**
 * Invite-code step of registration.
 *
 * When `resume` is true the visitor is signed in with a non-active membership
 * and is re-choosing the cashier path. Their request is resubmitted through
 * `resubmitJoinAsCashier` (no second sign-in) and must be approved by the owner.
 */
export function JoinForm({ resume = false }) {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event) {
    event.preventDefault();
    if (pending) return;

    setError(null);

    startTransition(async () => {
      if (resume) {
        const res = await resubmitJoinAsCashier({ inviteCode });
        if (!res?.ok) {
          setError(res?.error ?? "Gagal mengirim permintaan bergabung.");
          return;
        }
        router.push("/dashboard");
        router.refresh();
        return;
      }

      const res = await completeJoinOnboarding({ inviteCode });

      if (res?.error) {
        setError(res.error);
        return;
      }

      const signInRes = await signIn("credentials", {
        email: res.email,
        onboardingToken: res.grant,
        redirect: false,
      });

      if (signInRes?.error) {
        setError(
          "Berhasil bergabung, tetapi gagal masuk otomatis. Silakan masuk lewat halaman login."
        );
        return;
      }

      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          Gabung ke Bisnis
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
          {resume
            ? "Permintaan bergabung akan dikirim ke owner bisnis dan menunggu persetujuan."
            : "Masukkan kode undangan yang diberikan oleh pemilik toko."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthError message={error} />

        <div>
          <label htmlFor="invite-code" className={authLabelClass}>
            Kode Undangan
          </label>
          <div className="relative">
            <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              id="invite-code"
              name="inviteCode"
              type="text"
              required
              autoComplete="off"
              spellCheck={false}
              placeholder="TB-XXXXX"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              className={`${authInputClass} uppercase font-mono tracking-wider`}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
            Format kode: huruf dan angka, contoh{" "}
            <span className="font-mono">BRK-7712</span>. Tanyakan ke pemilik toko
            jika belum punya.
          </p>
        </div>

        <div className="pt-1">
          <button
            type="submit"
            disabled={pending}
            className={authPrimaryButtonClass}
          >
            {pending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>
                  {resume ? "Mengirim permintaan…" : "Memeriksa kode…"}
                </span>
              </>
            ) : (
              <>
                <span>{resume ? "Kirim Permintaan" : "Gabung & Masuk"}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>

      <p className="mt-5 text-center text-xs text-gray-500 dark:text-gray-400">
        <Link
          href="/register/choice"
          className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-400 font-semibold hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Kembali ke pilihan</span>
        </Link>
      </p>
    </>
  );
}
