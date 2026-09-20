"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  KeyRound,
  RefreshCw,
  Loader2,
  Users,
  Trash2,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import { regenerateInviteCode } from "@/app/actions/profile";
import { removeMember } from "@/app/actions/members";
import { InviteCodeCopy } from "@/app/dashboard/InviteCodeCopy";
import { AuthError, AuthSuccess } from "@/components/AuthUi";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const sectionCardClass =
  "glass-card rounded-2xl border border-white/40 dark:border-white/10 shadow-md p-5 sm:p-6";

const secondaryButtonClass =
  "px-4 py-2.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/10 disabled:opacity-60 disabled:cursor-not-allowed font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1a1625]";

const dangerButtonClass =
  "px-3.5 py-2 rounded-lg border border-rose-200 dark:border-rose-500/25 bg-white/70 dark:bg-white/5 text-rose-600 dark:text-rose-300 text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1a1625]";

const ROLE_BADGES = {
  owner: {
    label: "Pemilik",
    icon: ShieldCheck,
    className:
      "bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/25",
  },
  cashier: {
    label: "Kasir",
    icon: UserIcon,
    className:
      "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/25",
  },
};

function SectionHeader({ icon: Icon, title, description }) {
  return (
    <div className="flex items-start gap-3 pb-4 mb-5 border-b border-gray-200 dark:border-white/10">
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

function RoleBadge({ role }) {
  const badge = ROLE_BADGES[role] ?? ROLE_BADGES.cashier;
  const Icon = badge.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shrink-0 ${badge.className}`}
    >
      <Icon className="w-3 h-3" />
      {badge.label}
    </span>
  );
}

/**
 * Invite-code display plus regeneration, confirmed through the shared
 * `ConfirmDialog` (never a browser confirm). The displayed code is local
 * state so a successful regeneration updates it instantly.
 */
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
        setError(res?.error ?? "Gagal membuat kode undangan baru.");
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

      <div
        data-testid="tim-invite-code"
        className="flex flex-wrap items-center gap-3"
      >
        <InviteCodeCopy code={inviteCode} />
        <button
          type="button"
          data-testid="tim-regenerate-invite"
          disabled={pending}
          onClick={() => {
            setError(null);
            setSuccess(null);
            setOpen(true);
          }}
          className={secondaryButtonClass}
        >
          {pending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          <span>Buat kode baru</span>
        </button>
      </div>

      <ConfirmDialog
        open={open}
        title="Buat kode undangan baru?"
        description="Kode undangan lama langsung tidak berlaku. Anggota baru harus memakai kode yang baru."
        onDismiss={close}
        dismissible={!pending}
        actions={[
          { label: "Batal", tone: "neutral", onClick: close },
          {
            label: "Buat kode baru",
            tone: "primary",
            loading: pending,
            onClick: handleRegenerate,
          },
        ]}
      />
    </section>
  );
}

/**
 * Destructive "Hapus dari bisnis" control confirmed through the shared
 * `ConfirmDialog`. Errors and the success notice are reported through
 * `onNotice` so the message survives the row unmounting after a successful
 * server refresh.
 */
function RemoveMemberAction({ userId, userName, onNotice }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function close() {
    if (pending) return;
    setOpen(false);
  }

  function handleRemove() {
    if (pending) return;
    startTransition(async () => {
      const res = await removeMember(userId);
      setOpen(false);
      if (res?.ok) {
        onNotice({
          type: "success",
          message: `${userName} berhasil dihapus dari bisnis.`,
        });
        router.refresh();
      } else {
        onNotice({
          type: "error",
          message: res?.error ?? "Gagal menghapus anggota. Silakan coba lagi.",
        });
      }
    });
  }

  return (
    <>
      <button
        type="button"
        data-testid="tim-remove-member"
        data-member-id={userId}
        onClick={() => setOpen(true)}
        aria-label={`Hapus ${userName} dari bisnis`}
        className={dangerButtonClass}
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span>Hapus dari bisnis</span>
      </button>
      <ConfirmDialog
        open={open}
        title="Hapus anggota?"
        description={
          <>
            <strong>{userName}</strong> akan dihapus dari bisnis ini dan
            langsung kehilangan akses. Tindakan ini tidak bisa dibatalkan.
          </>
        }
        onDismiss={close}
        dismissible={!pending}
        actions={[
          { label: "Batal", tone: "neutral", onClick: close },
          {
            label: "Hapus",
            tone: "danger",
            loading: pending,
            onClick: handleRemove,
          },
        ]}
      />
    </>
  );
}

/**
 * Owner-only team page: invite-code management plus the active member list.
 * `currentUserId` hides the destructive action on the owner's own row, and
 * only cashiers can ever be removed.
 */
export function TimManagement({
  inviteCode,
  members,
  currentUserId,
}) {
  const [notice, setNotice] = useState(null);

  const hasCashier = members.some((memberRow) => memberRow.role === "cashier");

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#181126] dark:text-white">
          Tim
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Kelola kode undangan dan anggota tim kasir bisnis Anda.
        </p>
      </header>

      <InviteCodeSection initialInviteCode={inviteCode} />

      {/* Removal feedback sits directly above the member list so the
          confirmation appears exactly where the removal happened. */}
      {notice ? (
        <div className="space-y-2">
          <AuthError
            message={notice.type === "error" ? notice.message : null}
          />
          <AuthSuccess
            message={notice.type === "success" ? notice.message : null}
          />
        </div>
      ) : null}

      <section className={sectionCardClass}>
        <SectionHeader
          icon={Users}
          title="Anggota Tim"
          description="Anggota yang sudah bergabung. Hapus akses bila kasir tidak lagi bekerja di toko Anda."
        />

        {members.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Belum ada anggota tim.
          </p>
        ) : (
          <div
            data-testid="tim-member-list"
            className="divide-y divide-gray-100 dark:divide-white/5"
          >
            {members.map((memberRow) => {
              const isSelf = memberRow.id === currentUserId;
              const removable = memberRow.role === "cashier" && !isSelf;
              const initial = (
                memberRow.name?.trim()?.[0] ?? "?"
              ).toUpperCase();
              return (
                <div
                  key={memberRow.id}
                  data-testid="tim-member-row"
                  data-member-id={memberRow.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 py-3.5 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-violet-100 dark:bg-violet-500/15 border border-violet-200 dark:border-violet-500/25 text-violet-700 dark:text-violet-300 flex items-center justify-center text-xs font-bold shrink-0">
                      {initial}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {memberRow.name}
                        </h3>
                        <RoleBadge role={memberRow.role} />
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                        {memberRow.email}
                      </p>
                    </div>
                  </div>
                  {isSelf ? (
                    <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-500 shrink-0">
                      Anda
                    </span>
                  ) : removable ? (
                    <RemoveMemberAction
                      userId={memberRow.id}
                      userName={memberRow.name}
                      onNotice={setNotice}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        {!hasCashier && members.length > 0 ? (
          <p className="mt-4 pt-4 border-t border-gray-100 dark:border-white/5 text-xs text-gray-500 dark:text-gray-400">
            Belum ada kasir yang bergabung. Bagikan kode undangan di atas untuk
            mengundang kasir ke bisnis Anda.
          </p>
        ) : null}
      </section>
    </div>
  );
}
