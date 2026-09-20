"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  UserPlus,
  Users,
  Inbox,
  Trash2,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import { removeMember } from "@/app/actions/members";
import { AuthError, AuthSuccess } from "@/components/AuthUi";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MemberReviewActions } from "./MemberReviewActions";

const sectionCardClass =
  "glass-card rounded-2xl border border-white/40 dark:border-white/10 shadow-md p-5 sm:p-6";

const dangerButtonClass =
  "px-3.5 py-2 rounded-lg border border-rose-200 dark:border-rose-500/25 bg-white/70 dark:bg-white/5 text-rose-600 dark:text-rose-300 text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1a1625]";

const ROLE_BADGES = {
  owner: {
    label: "Pemilik",
    icon: ShieldCheck,
    className:
      "bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/25",
  },
  kasir: {
    label: "Kasir",
    icon: UserIcon,
    className:
      "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25",
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
  const badge = ROLE_BADGES[role] ?? ROLE_BADGES.kasir;
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
 * Owner-only member management: pending join requests plus the active team.
 * `currentUserId` hides the destructive action on the owner's own row.
 */
export function MemberManagement({
  pendingMembers,
  activeMembers,
  currentUserId,
}) {
  const [notice, setNotice] = useState(null);

  return (
    <div className="mt-8">
      <div className="space-y-5">
        {/* Pending join requests */}
        <section className={sectionCardClass}>
          <SectionHeader
            icon={UserPlus}
            title="Permintaan bergabung"
            description="Tinjau permintaan dari kasir yang ingin bergabung ke bisnis Anda."
          />

          {pendingMembers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 dark:border-white/10 px-4 py-8 text-center">
              <div className="w-11 h-11 rounded-2xl bg-violet-100 dark:bg-violet-500/15 border border-violet-200 dark:border-violet-500/25 text-violet-600 dark:text-violet-300 flex items-center justify-center mx-auto mb-3">
                <Inbox className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Tidak ada permintaan bergabung
              </h3>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">
                Bagikan kode undangan bisnis Anda di atas kepada kasir untuk
                mengundang mereka bergabung.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingMembers.map((pending) => (
                <div
                  key={pending.id}
                  className="rounded-xl border border-white/40 dark:border-white/10 bg-white/50 dark:bg-white/5 p-4 flex flex-col sm:flex-row sm:items-center gap-4"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/25 text-amber-600 dark:text-amber-300 flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                        {pending.name}
                      </h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                        {pending.email}
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-500 mt-0.5">
                        Mengajukan pada {pending.dateLabel}
                      </p>
                    </div>
                  </div>
                  <MemberReviewActions
                    userId={pending.id}
                    userName={pending.name}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Removal feedback sits directly above the active-members card so
            the confirmation appears exactly where the removal happened. */}
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

        {/* Active members */}
        <section className={sectionCardClass}>
          <SectionHeader
            icon={Users}
            title="Anggota aktif"
            description="Anggota yang sudah bergabung. Hapus akses bila kasir tidak lagi bekerja di toko Anda."
          />

          {activeMembers.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Belum ada anggota aktif.
            </p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-white/5">
              {activeMembers.map((memberRow) => {
                const isSelf = memberRow.id === currentUserId;
                const initial = (
                  memberRow.name?.trim()?.[0] ?? "?"
                ).toUpperCase();
                return (
                  <div
                    key={memberRow.id}
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
                    ) : (
                      <RemoveMemberAction
                        userId={memberRow.id}
                        userName={memberRow.name}
                        onNotice={setNotice}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
