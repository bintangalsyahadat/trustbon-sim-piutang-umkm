import { prisma } from "@/lib/prisma";
import { requireActiveMember } from "@/lib/session-guards";
import { DashboardShell } from "@/components/DashboardShell";
import { ToastProvider } from "@/components/Toast";

export default async function DashboardLayout({ children }) {
  // Authoritative gate for the whole dashboard: redirects to /login when
  // signed out, to /menunggu-persetujuan when not yet active, and to
  // /register/choice when the member has been removed from their business.
  const { member } = await requireActiveMember();
  const isOwner = member.role === "owner";

  const [pendingCount, unreadCount] = await Promise.all([
    isOwner
      ? prisma.user.count({
          where: { businessId: member.businessId, status: "pending" },
        })
      : 0,
    prisma.notification.count({
      where: { userId: member.id, readAt: null },
    }),
  ]);

  return (
    <ToastProvider>
      <DashboardShell
        userName={member.name}
        isOwner={isOwner}
        pendingCount={pendingCount}
        unreadCount={unreadCount}
      >
        {children}
      </DashboardShell>
    </ToastProvider>
  );
}
