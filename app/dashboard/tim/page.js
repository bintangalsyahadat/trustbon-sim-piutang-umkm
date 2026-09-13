import { UserCog } from "lucide-react";
import { requireOwner } from "@/lib/session-guards";
import { ComingSoon } from "@/components/dashboard/ComingSoon";

export const metadata = { title: "Tim — TrustBon" };

export default async function TimPage() {
  await requireOwner();

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn">
      <ComingSoon
        title="Tim"
        description="Kelola anggota tim kasir dan peran mereka."
        icon={UserCog}
      />
    </div>
  );
}
