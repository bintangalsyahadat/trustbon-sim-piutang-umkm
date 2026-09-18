import { redirect } from "next/navigation";
import { requireActiveMember } from "@/lib/session-guards";

export default async function TransaksiBaruPage() {
  await requireActiveMember();
  redirect("/dashboard/transaksi");
}
