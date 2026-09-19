import { Suspense } from "react";
import { requireActiveMember } from "@/lib/session-guards";
import { CashierDashboard } from "./CashierDashboard";
import { OwnerDashboard } from "./OwnerDashboard";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";

export const metadata = {
  title: "Dashboard — TrustBon",
};

export default async function DashboardPage() {
  const { member } = await requireActiveMember();
  const isOwner = member.role === "owner";

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      {isOwner ? (
        <OwnerDashboard member={member} />
      ) : (
        <CashierDashboard member={member} />
      )}
    </Suspense>
  );
}
