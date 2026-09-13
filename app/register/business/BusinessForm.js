"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Building2, User, Phone, ArrowRight, Loader2 } from "lucide-react";
import { completeBusinessOnboarding } from "@/app/actions/auth";
import { convertToOwnerBusiness } from "@/app/actions/onboarding-resume";
import {
  AuthError,
  authInputClass,
  authLabelClass,
  authPrimaryButtonClass,
  authLinkClass,
} from "@/components/AuthUi";

/**
 * Business-detail step of registration.
 *
 * When `resume` is true the visitor is signed in with a non-active membership
 * and is re-choosing the owner path. In that case we activate their existing
 * account through `convertToOwnerBusiness` (no second sign-in) instead of the
 * cookie-based first-time onboarding action.
 */
export function BusinessForm({ resume = false }) {
  const router = useRouter();
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event) {
    event.preventDefault();
    if (pending) return;

    const formData = new FormData(event.currentTarget);
    const payload = {
      name: formData.get("name")?.toString() ?? "",
      ownerName: formData.get("ownerName")?.toString() ?? "",
      ownerPhoneNumber: formData.get("ownerPhoneNumber")?.toString() ?? "",
    };

    setError(null);

    startTransition(async () => {
      if (resume) {
        const res = await convertToOwnerBusiness(payload);
        if (!res?.ok) {
          setError(res?.error ?? "Gagal menyimpan bisnis.");
          return;
        }
        router.push("/dashboard");
        router.refresh();
        return;
      }

      const res = await completeBusinessOnboarding(payload);

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
          "Bisnis berhasil dibuat, tetapi gagal masuk otomatis. Silakan masuk lewat halaman login."
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
          Detail Bisnis Anda
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
          Informasi ini dipakai untuk profil toko dan reminder WhatsApp.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthError message={error} />

        <div>
          <label htmlFor="business-name" className={authLabelClass}>
            Nama Usaha / Toko
          </label>
          <div className="relative">
            <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              id="business-name"
              name="name"
              type="text"
              required
              autoComplete="organization"
              placeholder="Contoh: Toko Sembako Makmur Jaya"
              className={authInputClass}
            />
          </div>
        </div>

        <div>
          <label htmlFor="owner-name" className={authLabelClass}>
            Nama Pemilik
          </label>
          <div className="relative">
            <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              id="owner-name"
              name="ownerName"
              type="text"
              required
              autoComplete="name"
              placeholder="Contoh: Budi Santoso"
              className={authInputClass}
            />
          </div>
        </div>

        <div>
          <label htmlFor="owner-phone" className={authLabelClass}>
            Nomor HP Pemilik (WhatsApp)
          </label>
          <div className="relative">
            <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              id="owner-phone"
              name="ownerPhoneNumber"
              type="tel"
              required
              autoComplete="tel"
              placeholder="08123456789"
              className={authInputClass}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
            Dipakai untuk kebutuhan reminder dan verifikasi toko.
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
                <span>Membuat bisnis…</span>
              </>
            ) : (
              <>
                <span>{resume ? "Buat Bisnis & Aktifkan" : "Buat Bisnis & Masuk"}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>

      <p className="mt-5 text-center text-xs text-gray-500 dark:text-gray-400">
        Salah memilih peran?{" "}
        <Link href="/register/choice" className={authLinkClass}>
          Kembali ke pilihan
        </Link>
      </p>
    </>
  );
}
