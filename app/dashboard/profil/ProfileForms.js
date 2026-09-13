"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { User, Mail, KeyRound, Loader2 } from "lucide-react";
import { updateUserProfile, changePassword } from "@/app/actions/profile";
import { useUnsavedChangesGuard } from "@/components/NavigationGuard";
import {
  AuthError,
  AuthSuccess,
  authInputClass,
  authLabelClass,
} from "@/components/AuthUi";

const sectionCardClass =
  "glass-card rounded-2xl border border-white/40 dark:border-white/10 shadow-md p-5 sm:p-6";

const submitButtonClass =
  "px-4 py-2.5 rounded-lg bg-violet-500 hover:bg-violet-600 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-violet-500 text-white font-semibold text-xs shadow-md shadow-violet-500/30 dark:shadow-black/30 transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1a1625]";

const stickyHeaderClass =
  "sticky top-16 z-20 -mx-5 px-5 sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12 xl:-mx-16 xl:px-16 py-4 bg-white/75 dark:bg-[#1a1625]/75 backdrop-blur-xl border-b border-white/40 dark:border-white/10";

function SectionHeader({ icon: Icon, title, description }) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-500/15 border border-violet-200 dark:border-violet-500/25 text-violet-600 dark:text-violet-300 flex items-center justify-center shrink-0">
        <Icon className="w-4.5 h-4.5" />
      </div>
      <div>
        <h2 className="text-sm font-bold text-gray-900 dark:text-white">
          {title}
        </h2>
        <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
          {description}
        </p>
      </div>
    </div>
  );
}

function AccountForm({ initialName, initialEmail }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [currentPassword, setCurrentPassword] = useState("");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [pending, startTransition] = useTransition();

  const emailChanged =
    email.trim().toLowerCase() !== initialEmail.toLowerCase();
  const dirty = name !== initialName || email !== initialEmail;

  async function save() {
    setError(null);
    setSuccess(null);
    const res = await updateUserProfile({
      name,
      email,
      currentPassword: emailChanged ? currentPassword : undefined,
    });
    if (!res?.ok) {
      setError(res?.error ?? "Gagal menyimpan profil.");
      return false;
    }
    if (res.reauthRequired) {
      // Email is the login identity — sign out so the session is re-established
      // with the new address, and carry a success note to the login page.
      await signOut({ redirect: false });
      router.push("/login?pesan=email-diubah");
      router.refresh();
      // The page owns this redirect; the guard must not continue to its pending href.
      return "handled";
    }
    setSuccess("Nama berhasil diperbarui.");
    router.refresh();
    return true;
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (pending) return;
    startTransition(async () => {
      await save();
    });
  }

  function handleGuardSave() {
    if (pending) return false;
    return save();
  }

  function handleDiscard() {
    setName(initialName);
    setEmail(initialEmail);
    setCurrentPassword("");
    setError(null);
    setSuccess(null);
  }

  useUnsavedChangesGuard({
    dirty,
    save: handleGuardSave,
    discard: handleDiscard,
  });

  return (
    <form onSubmit={handleSubmit}>
      <div className={stickyHeaderClass}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#181126] dark:text-white">
              Profil
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Kelola informasi akun dan keamanan Anda.
            </p>
          </div>
          {dirty ? (
            <button
              type="submit"
              disabled={pending}
              className={`${submitButtonClass} shrink-0`}
            >
              {pending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Menyimpan…</span>
                </>
              ) : (
                <span>Simpan</span>
              )}
            </button>
          ) : null}
        </div>

        {error || success ? (
          <div className="mt-3 space-y-2">
            <AuthError message={error} />
            <AuthSuccess message={success} />
          </div>
        ) : null}
      </div>

      <div className="mt-4 space-y-5">
        <section className={sectionCardClass}>
          <SectionHeader
            icon={User}
            title="Nama"
            description="Nama ini terlihat oleh pemilik dan anggota bisnis Anda."
          />
          <div className="space-y-4">
            <div>
              <label htmlFor="profile-name" className={authLabelClass}>
                Nama Lengkap
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  id="profile-name"
                  type="text"
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={authInputClass}
                />
              </div>
            </div>
          </div>
        </section>

        <section className={sectionCardClass}>
          <SectionHeader
            icon={Mail}
            title="Email"
            description="Dipakai untuk masuk ke akun Anda. Mengubah email memerlukan password dan Anda akan diminta masuk ulang."
          />
          <div className="space-y-4">
            <div>
              <label htmlFor="profile-email" className={authLabelClass}>
                Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  id="profile-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={authInputClass}
                />
              </div>
            </div>

            {emailChanged ? (
              <div className="animate-fadeIn">
                <label
                  htmlFor="profile-email-password"
                  className={authLabelClass}
                >
                  Password Saat Ini
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    id="profile-email-password"
                    type="password"
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className={authInputClass}
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                  Wajib diisi untuk memastikan perubahan email dilakukan oleh
                  Anda.
                </p>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </form>
  );
}

function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await changePassword({ currentPassword, newPassword });
      if (res?.ok) {
        setSuccess("Password berhasil diubah.");
        setCurrentPassword("");
        setNewPassword("");
      } else {
        setError(res?.error ?? "Gagal mengubah password.");
      }
    });
  }

  return (
    <section className={sectionCardClass}>
      <SectionHeader
        icon={KeyRound}
        title="Ubah Password"
        description="Password baru minimal 8 karakter."
      />
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthError message={error} />
        <AuthSuccess message={success} />
        <div>
          <label htmlFor="profile-current-password" className={authLabelClass}>
            Password Saat Ini
          </label>
          <div className="relative">
            <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              id="profile-current-password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={authInputClass}
            />
          </div>
        </div>
        <div>
          <label htmlFor="profile-new-password" className={authLabelClass}>
            Password Baru
          </label>
          <div className="relative">
            <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              id="profile-new-password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Minimal 8 karakter"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={authInputClass}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={pending} className={submitButtonClass}>
            {pending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Menyimpan…</span>
              </>
            ) : (
              <span>Simpan Password</span>
            )}
          </button>
        </div>
      </form>
    </section>
  );
}

export function ProfileForms({ initialName, initialEmail }) {
  return (
    <>
      <AccountForm initialName={initialName} initialEmail={initialEmail} />
      <div className="mt-5">
        <PasswordForm />
      </div>
    </>
  );
}
