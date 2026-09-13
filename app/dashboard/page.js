import {
  ShieldCheck,
  User as UserIcon,
  Users,
  Receipt,
  MessageSquare,
  Sparkles,
  KeyRound,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireActiveMember } from "@/lib/session-guards";
import { InviteCodeCopy } from "./InviteCodeCopy";

export const metadata = {
  title: "Dashboard — TrustBon",
};

export default async function DashboardPage() {
  const { member } = await requireActiveMember();

  const name = member.name ?? "Pengguna";
  const isOwner = member.role === "owner";

  // Owners need their business invite code to onboard cashiers. A missing
  // business simply hides the card.
  let business = null;
  if (isOwner && member.businessId != null) {
    business = await prisma.business.findUnique({
      where: { id: member.businessId },
      select: { name: true, inviteCode: true },
    });
  }

  const roleBadge = isOwner
    ? {
        icon: ShieldCheck,
        label: "Owner · Pemilik",
        className:
          "bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/25",
      }
    : {
        icon: UserIcon,
        label: "Kasir",
        className:
          "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25",
      };
  const RoleIcon = roleBadge.icon;

  const cards = [
    {
      icon: Users,
      title: "Pelanggan",
      description: isOwner
        ? "Kelola daftar pelanggan, atur limit kredit, dan pantau skor kepercayaan masing-masing."
        : "Lihat pelanggan toko beserta sisa limit kasbon dan status skor mereka.",
    },
    {
      icon: Receipt,
      title: "Piutang",
      description: isOwner
        ? "Pantau semua kasbon berjalan dan setujui transaksi yang melebihi limit kredit."
        : "Catat kasbon harian pelanggan dengan proteksi limit otomatis.",
    },
    {
      icon: MessageSquare,
      title: "Reminder WhatsApp",
      description: isOwner
        ? "Jadwalkan pengingat tagihan yang sopan dan terkirim otomatis via WhatsApp."
        : "Pengingat tagihan terkirim otomatis atas nama toko — tanpa perlu mengetik manual.",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn">
      {/* Greeting + identity */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#181126] dark:text-white">
          Halo, {name}
        </h1>
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${roleBadge.className}`}
        >
          <RoleIcon className="w-3.5 h-3.5" />
          {roleBadge.label}
        </span>
      </div>

      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
        Selamat datang di dashboard TrustBon Anda.
      </p>

      {/* Placeholder banner */}
      <div className="mt-8 glass-panel rounded-2xl border border-white/60 dark:border-white/20 shadow-lg p-5 sm:p-6 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-500/15 border border-violet-200 dark:border-violet-500/25 text-violet-600 dark:text-violet-300 flex items-center justify-center shrink-0">
          <Sparkles className="w-4.5 h-4.5" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">
            Dashboard sedang disiapkan
          </h2>
          <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
            Akun Anda sudah aktif. Berikut gambaran fitur yang akan hadir
            untuk peran Anda sebagai{" "}
            <span className="font-semibold text-violet-700 dark:text-violet-300">
              {isOwner ? "Owner" : "Kasir"}
            </span>
            .
          </p>
        </div>
      </div>

      {/* Owner-only: business invite code for cashier onboarding */}
      {isOwner && business ? (
        <div className="mt-6 glass-panel rounded-2xl border border-white/60 dark:border-white/20 shadow-lg p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-500/15 border border-violet-200 dark:border-violet-500/25 text-violet-600 dark:text-violet-300 flex items-center justify-center shrink-0">
              <KeyRound className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                Kode Undangan
              </p>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                {business.name}
              </h2>
              <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                Bagikan kode ini kepada kasir Anda agar bisa bergabung ke
                toko Anda.
              </p>
            </div>
          </div>
          <InviteCodeCopy code={business.inviteCode} />
        </div>
      ) : null}

      {/* Coming-soon feature cards */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="glass-card rounded-2xl p-6 border border-white/40 dark:border-white/10 shadow-md flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-violet-300 dark:hover:border-violet-500/40"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-11 h-11 rounded-xl bg-violet-100 dark:bg-violet-500/15 border border-violet-200 dark:border-violet-500/25 text-violet-600 dark:text-violet-300 flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25">
                  Segera Hadir
                </span>
              </div>

              <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1.5">
                {card.title}
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                {card.description}
              </p>

              {/* Skeleton lines to signal placeholder content */}
              <div className="mt-auto pt-5 space-y-2">
                <div className="h-1.5 rounded-full bg-gray-200/80 dark:bg-white/5 w-full" />
                <div className="h-1.5 rounded-full bg-gray-200/80 dark:bg-white/5 w-2/3" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
