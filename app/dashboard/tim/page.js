import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/session-guards";
import { TimManagement } from "./TimManagement";

export const metadata = { title: "Tim — TrustBon" };

export default async function TimPage() {
  const { member } = await requireOwner();

  const [business, activeMembers] = await Promise.all([
    prisma.business.findUnique({
      where: { id: member.businessId },
      select: { inviteCode: true },
    }),
    prisma.user.findMany({
      where: { businessId: member.businessId, status: "active" },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!business) {
    return null;
  }

  // Plain serializable data for the client component — no Date objects.
  const members = activeMembers.map((active) => ({
    id: active.id,
    name: active.name,
    email: active.email,
    role: active.role,
  }));

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn">
      <TimManagement
        inviteCode={business.inviteCode}
        members={members}
        currentUserId={member.id}
      />
    </div>
  );
}
