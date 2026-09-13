import { Bell } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireActiveMember } from "@/lib/session-guards";
import { NotificationsList } from "./NotificationsList";

export const metadata = {
  title: "Notifikasi — TrustBon",
};

const dateTimeFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function NotifikasiPage() {
  const { member } = await requireActiveMember();

  const notifications = await prisma.notification.findMany({
    where: { userId: member.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      href: true,
      readAt: true,
      createdAt: true,
    },
  });

  // Plain serializable data for the client list — no Date objects, no raw ids rendered.
  const items = notifications.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    href: n.href,
    read: n.readAt !== null,
    dateLabel: dateTimeFormatter.format(n.createdAt),
  }));

  return (
    <div className="max-w-3xl mx-auto animate-fadeIn">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#181126] dark:text-white">
          Notifikasi
        </h1>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/25">
          <Bell className="w-3 h-3" />
          {items.filter((i) => !i.read).length} belum dibaca
        </span>
      </div>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
        Kabar terbaru tentang akun dan bisnis Anda.
      </p>

      <NotificationsList items={items} />
    </div>
  );
}
