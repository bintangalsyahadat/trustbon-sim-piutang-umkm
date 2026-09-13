import { History } from "lucide-react";
import { requireActiveMember } from "@/lib/session-guards";
import { ComingSoon } from "@/components/dashboard/ComingSoon";

export const metadata = { title: "Riwayat Pelanggan — TrustBon" };

export default async function RiwayatPelangganPage() {
  await requireActiveMember();

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn">
      <ComingSoon
        title="Riwayat Pelanggan"
        description="Lihat riwayat transaksi dan sisa limit setiap pelanggan."
        icon={History}
      />
    </div>
  );
}
