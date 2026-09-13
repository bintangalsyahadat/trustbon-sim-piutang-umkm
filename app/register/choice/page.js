import Link from "next/link";
import {
  Building2,
  KeyRound,
  ArrowRight,
  Info,
  AlertTriangle,
} from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AuthShell, AuthStepper } from "@/components/AuthUi";

const choices = [
  {
    href: "/register/business",
    icon: Building2,
    badge: "Untuk Owner",
    badgeClass:
      "bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/25",
    tileClass:
      "bg-violet-100 text-violet-600 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/25",
    title: "Buat Bisnis Baru",
    description:
      "Daftarkan toko atau warung Anda, atur limit kredit pelanggan, dan dapatkan kode undangan untuk kasir.",
  },
  {
    href: "/register/join",
    icon: KeyRound,
    badge: "Untuk Kasir",
    badgeClass:
      "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25",
    tileClass:
      "bg-amber-100 text-amber-600 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25",
    title: "Punya Kode Undangan",
    description:
      "Gabung ke toko yang sudah terdaftar menggunakan kode undangan dari pemilik usaha.",
  },
];

export default async function RegisterChoicePage() {
  const session = await auth();
  const userId = Number(session?.user?.id);
  const hasUser = Number.isInteger(userId);

  // DB-authoritative status (the JWT `status` is only a stale routing hint).
  // `removed` members are redirected here by requireActiveMember() and are
  // shown the unread member_removed notification so they know why.
  const [member, removalNotice] = hasUser
    ? await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: { status: true },
        }),
        prisma.notification.findFirst({
          where: { userId, type: "member_removed", readAt: null },
          orderBy: { createdAt: "desc" },
          select: { title: true, body: true },
        }),
      ])
    : [null, null];

  // Copy depends on the DB-authoritative status. Only a pending member gets the
  // waiting-for-approval info; a rejected member gets no box at all (product
  // decision: the role options below already explain what to do next).
  const statusMessage =
    member?.status === "pending"
      ? "Anda sedang menunggu persetujuan. Anda tetap bisa memilih ulang di bawah ini."
      : null;

  return (
    <AuthShell wide>
      <AuthStepper current={2} label="Pilih peran" />

      <div className="mb-7 text-center">
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          Bagaimana Anda akan mulai?
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          Pilih peran Anda di dalam bisnis. Keduanya terhubung dalam satu toko
          yang sama.
        </p>
      </div>

      {removalNotice ? (
        <div
          role="alert"
          className="mb-6 flex items-start gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 text-rose-800 dark:text-rose-300 text-xs font-medium animate-fadeIn"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
          <div>
            <p className="font-bold">{removalNotice.title}</p>
            {removalNotice.body ? (
              <p className="mt-0.5 leading-relaxed">{removalNotice.body}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {statusMessage ? (
        <div className="mb-6 flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 text-amber-800 dark:text-amber-300 text-xs font-medium animate-fadeIn">
          <Info className="w-4 h-4 shrink-0 mt-px" />
          <span>{statusMessage}</span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {choices.map((choice) => {
          const Icon = choice.icon;
          return (
            <Link
              key={choice.href}
              href={choice.href}
              className="group glass-card rounded-2xl p-6 border border-white/40 dark:border-white/10 shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-violet-300 dark:hover:border-violet-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1a1625]"
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className={`w-11 h-11 rounded-xl border flex items-center justify-center transition-transform group-hover:scale-105 ${choice.tileClass}`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${choice.badgeClass}`}
                >
                  {choice.badge}
                </span>
              </div>

              <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1.5">
                {choice.title}
              </h2>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
                {choice.description}
              </p>

              <span className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 dark:text-violet-400">
                <span>Lanjutkan</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          );
        })}
      </div>
    </AuthShell>
  );
}
