import { BarChart3 } from "lucide-react";
import { requireOwner } from "@/lib/session-guards";
import { ComingSoon } from "@/components/dashboard/ComingSoon";

export const metadata = { title: "Laporan — TrustBon" };

export default async function LaporanPage() {
  await requireOwner();

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn">
      <ComingSoon
        title="Laporan"
        description="Unduh dan tinjau laporan piutang serta performa pembayaran."
        icon={BarChart3}
      />
    </div>
  );
}
