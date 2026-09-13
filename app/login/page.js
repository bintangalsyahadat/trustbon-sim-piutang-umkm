"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Mail, ArrowRight, Loader2 } from "lucide-react";
import {
  AuthShell,
  AuthError,
  AuthPasswordInput,
  authInputClass,
  authLabelClass,
  authPrimaryButtonClass,
  authLinkClass,
} from "@/components/AuthUi";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (pending) return;

    setError(null);
    setPending(true);

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError("Email atau password salah. Silakan periksa kembali.");
        setPending(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Terjadi kendala koneksi. Silakan coba lagi.");
      setPending(false);
    }
  }

  return (
    <AuthShell>
      <div className="mb-6 text-center">
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          Masuk ke TrustBon
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
          Kelola kasbon &amp; piutang usaha Anda dengan tenang.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthError message={error} />

        <div>
          <label htmlFor="login-email" className={authLabelClass}>
            Email
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              id="login-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="nama@tokoanda.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={authInputClass}
            />
          </div>
        </div>

        <AuthPasswordInput
          id="login-password"
          name="password"
          label="Password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
                <span>Sedang masuk…</span>
              </>
            ) : (
              <>
                <span>Masuk</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>

      <p className="mt-5 text-center text-xs text-gray-500 dark:text-gray-400">
        Belum punya akun?{" "}
        <Link href="/register" className={authLinkClass}>
          Daftar gratis
        </Link>
      </p>
    </AuthShell>
  );
}
