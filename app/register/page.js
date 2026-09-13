"use client";

import { useActionState } from "react";
import Link from "next/link";
import { User, Mail, ArrowRight, Loader2 } from "lucide-react";
import { registerPending } from "@/app/actions/auth";
import {
  AuthShell,
  AuthStepper,
  AuthError,
  AuthPasswordInput,
  authInputClass,
  authLabelClass,
  authPrimaryButtonClass,
  authLinkClass,
} from "@/components/AuthUi";

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(
    registerPending,
    undefined
  );

  return (
    <AuthShell>
      <AuthStepper current={1} label="Buat akun" />

      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          Buat Akun TrustBon
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
          Gratis, tanpa kartu kredit. Cukup 1 menit untuk memulai.
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        <AuthError message={state?.error} />

        <div>
          <label htmlFor="register-name" className={authLabelClass}>
            Nama Lengkap
          </label>
          <div className="relative">
            <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              id="register-name"
              name="name"
              type="text"
              required
              autoComplete="name"
              placeholder="Contoh: Budi Santoso"
              className={authInputClass}
            />
          </div>
        </div>

        <div>
          <label htmlFor="register-email" className={authLabelClass}>
            Email
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              id="register-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="nama@tokoanda.com"
              className={authInputClass}
            />
          </div>
        </div>

        <AuthPasswordInput
          id="register-password"
          name="password"
          label="Password"
          autoComplete="new-password"
          minLength={8}
          placeholder="Minimal 8 karakter"
          helper="Minimal 8 karakter. Gunakan kombinasi huruf dan angka agar lebih aman."
        />

        <div className="pt-1">
          <button
            type="submit"
            disabled={pending}
            className={authPrimaryButtonClass}
          >
            {pending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menyimpan…</span>
              </>
            ) : (
              <>
                <span>Lanjutkan</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>

      <p className="mt-5 text-center text-xs text-gray-500 dark:text-gray-400">
        Sudah punya akun?{" "}
        <Link href="/login" className={authLinkClass}>
          Masuk di sini
        </Link>
      </p>
    </AuthShell>
  );
}
