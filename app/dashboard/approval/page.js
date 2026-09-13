import { ClipboardCheck } from "lucide-react";
import { requireOwner } from "@/lib/session-guards";
import { ComingSoon } from "@/components/dashboard/ComingSoon";

export const metadata = { title: "Approval — TrustBon" };

export default async function ApprovalPage() {
  await requireOwner();

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn">
      <ComingSoon
        title="Approval"
        description="Tinjau kasbon yang melewati limit kredit sebelum disetujui."
        icon={ClipboardCheck}
      />
    </div>
  );
}
