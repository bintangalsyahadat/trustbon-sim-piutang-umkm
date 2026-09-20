import { BarChart3 } from "lucide-react";
import { requireOwner } from "@/lib/session-guards";
import { getReportData } from "@/lib/report-data";
import { LaporanClient } from "./LaporanClient";

export const metadata = { title: "Laporan — TrustBon" };

/**
 * Owner-only Reports page. Server component fetches the default 30-day
 * report on initial load; the client component can request arbitrary
 * date ranges via the fetchReport server action.
 */
export default async function LaporanPage() {
  const { member } = await requireOwner();

  // Default period: last 30 days (today inclusive)
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const start = new Date(now);
  start.setDate(start.getDate() - 29);
  const from = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;

  const initialData = await getReportData(member.businessId, { from, to });

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn">
      <LaporanClient initialData={initialData} />
    </div>
  );
}
