import { Wallet } from "lucide-react";
import { requireActiveMember } from "@/lib/session-guards";
import { ComingSoon } from "@/components/dashboard/ComingSoon";

export const metadata = { title: "Pembayaran — TrustBon" };

export default async function PembayaranPage() {
  await requireActiveMember();

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn">
      <ComingSoon
        title="Pembayaran"
        description="Catat pembayaran cicilan kasbon pelanggan."
        icon={Wallet}
      />
    </div>
  );
}
