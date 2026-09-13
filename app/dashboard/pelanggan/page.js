import { Users } from "lucide-react";
import { requireOwner } from "@/lib/session-guards";
import { ComingSoon } from "@/components/dashboard/ComingSoon";

export const metadata = { title: "Pelanggan — TrustBon" };

export default async function PelangganPage() {
  await requireOwner();

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn">
      <ComingSoon
        title="Pelanggan"
        description="Kelola data pelanggan, limit kredit, dan status kepercayaan."
        icon={Users}
      />
    </div>
  );
}
