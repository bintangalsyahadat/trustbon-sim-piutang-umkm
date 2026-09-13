import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/session-guards";
import { BusinessForms } from "./BusinessForms";
import { MemberManagement } from "./MemberManagement";

export const metadata = {
  title: "Bisnis — TrustBon",
};

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function BisnisPage() {
  const { member } = await requireOwner();

  const [business, pendingMembers, activeMembers] = await Promise.all([
    prisma.business.findUnique({
      where: { id: member.businessId },
      select: {
        name: true,
        ownerName: true,
        ownerPhoneNumber: true,
        inviteCode: true,
      },
    }),
    prisma.user.findMany({
      where: { businessId: member.businessId, status: "pending" },
      select: { id: true, name: true, email: true, createdAt: true },
      orderBy: { createdAt: "asc" },
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

  // Plain serializable data for the client components — no Date objects.
  const pendingItems = pendingMembers.map((pending) => ({
    id: pending.id,
    name: pending.name,
    email: pending.email,
    dateLabel: dateFormatter.format(pending.createdAt),
  }));

  const activeItems = activeMembers.map((active) => ({
    id: active.id,
    name: active.name,
    email: active.email,
    role: active.role,
  }));

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn">
      <BusinessForms
        initialName={business.name}
        initialOwnerName={business.ownerName}
        initialOwnerPhoneNumber={business.ownerPhoneNumber}
        initialInviteCode={business.inviteCode}
      />

      <MemberManagement
        pendingMembers={pendingItems}
        activeMembers={activeItems}
        currentUserId={member.id}
      />
    </div>
  );
}
