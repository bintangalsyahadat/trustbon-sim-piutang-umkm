"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  User,
  Phone,
  KeyRound,
  RefreshCw,
  Loader2,
} from "lucide-react";
import {
  updateBusinessProfile,
  regenerateInviteCode,
} from "@/app/actions/profile";
import { InviteCodeCopy } from "@/app/dashboard/InviteCodeCopy";
import { useUnsavedChangesGuard } from "@/components/NavigationGuard";
import { ConfirmDialog } from "@/components/ConfirmDialog";
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

const secondaryButtonClass =
  "px-4 py-2.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/10 disabled:opacity-60 disabled:cursor-not-allowed font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1a1625]";

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

function InviteCodeSection({ initialInviteCode }) {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState(initialInviteCode);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [pending, startTransition] = useTransition();

  function handleRegenerate() {
    if (pending) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await regenerateInviteCode();
      setOpen(false);
      if (res?.ok) {
        setInviteCode(res.inviteCode);
        setSuccess(
          "Kode undangan baru berhasil dibuat. Kode lama tidak berlaku lagi.",
        );
        router.refresh();
      } else {
        setError(res?.error ?? "Gagal membuat ulang kode undangan.");
      }
    });
  }

  function close() {
    if (pending) return;
    setOpen(false);
  }

  return (
    <section className={sectionCardClass}>
      <SectionHeader
        icon={KeyRound}
        title="Kode Undangan"
        description="Bagikan kode ini kepada kasir agar mereka bisa bergabung ke bisnis Anda."
      />
      <AuthError message={error} />
      <AuthSuccess message={success} />

      <div className="flex flex-wrap items-center gap-3">
        <InviteCodeCopy code={inviteCode} />
        <button
          type="button"
          onClick={() => {
            setError(null);
            setSuccess(null);
            setOpen(true);
          }}
          className={secondaryButtonClass}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Buat ulang kode</span>
        </button>
      </div>

      <ConfirmDialog
        open={open}
        title="Buat ulang kode undangan?"
        description="Kode undangan lama langsung tidak berlaku. Anggota baru harus memakai kode yang baru."
        onDismiss={close}
        dismissible={!pending}
        actions={[
          { label: "Batal", tone: "neutral", onClick: close },
          {
            label: "Buat ulang",
            tone: "primary",
            loading: pending,
            onClick: handleRegenerate,
          },
        ]}
      />
    </section>
  );
}

export function BusinessForms({
  initialName,
  initialOwnerName,
  initialOwnerPhoneNumber,
  initialInviteCode,
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [ownerName, setOwnerName] = useState(initialOwnerName);
  const [ownerPhoneNumber, setOwnerPhoneNumber] = useState(
    initialOwnerPhoneNumber,
  );
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [pending, startTransition] = useTransition();

  const dirty =
    name !== initialName ||
    ownerName !== initialOwnerName ||
    ownerPhoneNumber !== initialOwnerPhoneNumber;

  async function save() {
    setError(null);
    setSuccess(null);
    const res = await updateBusinessProfile({
      name,
      ownerName,
      ownerPhoneNumber,
    });
    if (!res?.ok) {
      setError(res?.error ?? "Gagal menyimpan profil bisnis.");
      return false;
    }
    setSuccess("Profil bisnis berhasil diperbarui.");
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
    setOwnerName(initialOwnerName);
    setOwnerPhoneNumber(initialOwnerPhoneNumber);
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
              Bisnis
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Kelola profil bisnis, kode undangan, dan anggota tim Anda.
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
        <InviteCodeSection initialInviteCode={initialInviteCode} />

        <section className={sectionCardClass}>
          <SectionHeader
            icon={Building2}
            title="Profil Bisnis"
            description="Informasi ini dipakai untuk profil toko dan reminder WhatsApp."
          />
          <div className="space-y-4">
            <div>
              <label htmlFor="business-name" className={authLabelClass}>
                Nama Usaha / Toko
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  id="business-name"
                  type="text"
                  required
                  autoComplete="organization"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={authInputClass}
                />
              </div>
            </div>

            <div>
              <label htmlFor="business-owner-name" className={authLabelClass}>
                Nama Pemilik
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  id="business-owner-name"
                  type="text"
                  required
                  autoComplete="name"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className={authInputClass}
                />
              </div>
            </div>

            <div>
              <label htmlFor="business-owner-phone" className={authLabelClass}>
                Nomor HP Pemilik (WhatsApp)
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  id="business-owner-phone"
                  type="tel"
                  required
                  autoComplete="tel"
                  value={ownerPhoneNumber}
                  onChange={(e) => setOwnerPhoneNumber(e.target.value)}
                  className={authInputClass}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                Dipakai untuk kebutuhan reminder dan verifikasi toko.
              </p>
            </div>
          </div>
        </section>
      </div>
    </form>
  );
}
