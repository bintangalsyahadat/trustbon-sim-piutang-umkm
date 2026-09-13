import { Receipt } from "lucide-react";
import { requireActiveMember } from "@/lib/session-guards";
import { ComingSoon } from "@/components/dashboard/ComingSoon";

export const metadata = { title: "Transaksi Baru — TrustBon" };

export default async function TransaksiBaruPage() {
  await requireActiveMember();

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn">
      <ComingSoon
        title="Transaksi Baru"
        description="Catat kasbon pelanggan dengan proteksi limit kredit otomatis."
        icon={Receipt}
      />
    </div>
  );
}
