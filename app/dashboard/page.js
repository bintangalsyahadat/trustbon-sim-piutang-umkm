import { prisma } from "@/lib/prisma";
import { requireActiveMember } from "@/lib/session-guards";
import { CashierDashboard } from "./CashierDashboard";
import { OwnerDashboard } from "./OwnerDashboard";

export const metadata = {
  title: "Dashboard — TrustBon",
};

export default async function DashboardPage() {
  const { member } = await requireActiveMember();
  const isOwner = member.role === "owner";

  // Only the identity is real (member + business name); the domain metrics
  // inside each dashboard still come from the dummy data module.
  let business = null;
  if (member.businessId != null) {
    business = await prisma.business.findUnique({
      where: { id: member.businessId },
      select: { name: true },
    });
  }
  const businessName = business?.name ?? "Bisnis Anda";

  return isOwner ? (
    <OwnerDashboard userName={member.name} businessName={businessName} />
  ) : (
    <CashierDashboard userName={member.name} businessName={businessName} />
  );
}
