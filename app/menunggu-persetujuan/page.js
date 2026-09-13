import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, Hourglass, XCircle, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session-guards";
import { ThemeToggle } from "@/components/ThemeToggle";
import { authLinkClass } from "@/components/AuthUi";
import { LogoutButton } from "@/app/dashboard/LogoutButton";
import { StatusPoller, CheckStatusButton } from "./WaitingRoomClient";

export const metadata = {
  title: "Menunggu Persetujuan — TrustBon",
};

export default async function MenungguPersetujuanPage() {
  const { session } = await requireSession();

  const userId = Number(session.user.id);
  const member = Number.isInteger(userId)
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { status: true, businessId: true },
      })
    : null;
  if (!member) {
    redirect("/login");
  }
  if (member.status === "active") {
    redirect("/dashboard");
  }
  // Removed members are detached from their business and must re-onboard.
  if (member.status === "removed") {
    redirect("/register/choice");
  }

  const business = await prisma.business.findUnique({
    where: { id: member.businessId },
    select: { name: true },
  });
  const businessName = business?.name ?? "bisnis tersebut";
  const rejected = member.status === "rejected";

  return (
    <div className="min-h-screen flex flex-col relative selection:bg-violet-500 selection:text-white">
      <div className="fixed top-4 right-4 z-20 flex items-center gap-2.5">
        <ThemeToggle id="waiting-theme-toggle" />
        <LogoutButton />
      </div>

      <main className="flex-1 flex items-center justify-center px-4 py-12 sm:py-16">
        <div className="w-full max-w-md animate-fadeIn">
          {/* Brand identity (matches the auth pages) */}
          <div className="flex w-fit mx-auto items-center gap-2.5 mb-7 px-2 py-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-violet-500/25 dark:shadow-black/30">
              <ShieldCheck className="w-5 h-5 text-violet-100" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-violet-600 to-violet-500 dark:from-violet-300 dark:to-violet-400 bg-clip-text text-transparent">
                  TrustBon
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-500/10 text-violet-800 dark:text-violet-300 border border-violet-200 dark:border-violet-500/20">
                  UMKM
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium tracking-tight -mt-0.5">
                Skor Risiko Piutang Kasbon
              </p>
            </div>
          </div>

          <div className="glass-panel rounded-2xl shadow-2xl border border-white/60 dark:border-white/20 p-6 sm:p-8 text-center">
            {rejected ? (
              <>
                <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/25 text-rose-600 dark:text-rose-300 flex items-center justify-center mx-auto mb-4">
                  <XCircle className="w-7 h-7" />
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                  Permintaan Ditolak
                </h1>
                <p className="mt-2 text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  Pemilik <strong>{businessName}</strong> menolak permintaan
                  bergabung Anda.
                </p>
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Anda bisa membuat bisnis sendiri atau bergabung dengan kode
                  undangan yang berbeda.
                </p>
                <div className="mt-6">
                  <Link
                    href="/register/choice"
                    className="w-full py-2.5 px-4 rounded-lg bg-violet-500 hover:bg-violet-600 text-white font-semibold text-sm shadow-md shadow-violet-500/30 dark:shadow-black/30 transition-all flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1a1625]"
                  >
                    <span>Pilih Opsi Lain</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/25 text-amber-600 dark:text-amber-300 flex items-center justify-center mx-auto mb-4">
                  <Hourglass className="w-7 h-7" />
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                  Menunggu Persetujuan Owner
                </h1>
                <p className="mt-2 text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  Permintaan Anda untuk bergabung ke{" "}
                  <strong>{businessName}</strong> sudah kami terima. Pemilik
                  bisnis perlu menyetujui pendaftaran Anda terlebih dahulu.
                </p>
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Anda belum bisa mengakses dashboard. Halaman ini akan
                  teralihkan otomatis setelah Anda disetujui.
                </p>

                <div className="mt-6 space-y-3">
                  <CheckStatusButton />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Tidak jadi menunggu?{" "}
                    <Link href="/register/choice" className={authLinkClass}>
                      Pilih opsi lain
                    </Link>
                  </p>
                </div>

                {/* Redirects automatically once the owner decides */}
                <StatusPoller />
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
