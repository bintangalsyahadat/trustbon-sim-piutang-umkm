import { redirect } from "next/navigation";
import { requireActiveMember } from "@/lib/session-guards";

export const metadata = { title: "Riwayat Pelanggan — TrustBon" };

/**
 * The "Riwayat Pelanggan" sidebar entry was removed because the customer
 * detail/history page already lives at /dashboard/pelanggan/[id].
 * This route now redirects to the customer list.
 */
export default async function RiwayatPelangganPage() {
  await requireActiveMember();
  redirect("/dashboard/pelanggan");
}
