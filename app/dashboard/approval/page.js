import { ClipboardCheck } from "lucide-react";
import { requireOwner } from "@/lib/session-guards";
import { prisma } from "@/lib/prisma";
import { businessPrefix, formatIDR, formatTransactionNumber } from "@/lib/format";
import { getActiveDebtByCustomer } from "@/lib/customer-debt";
import { ApprovalManagement } from "./ApprovalManagement";

export const metadata = { title: "Approval — TrustBon" };

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function ApprovalPage() {
  const { member: actor } = await requireOwner();

  const transactions = await prisma.transaction.findMany({
    where: {
      businessId: actor.businessId,
      paymentStatus: "need_approval",
    },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          creditLimit: true,
          riskScore: true,
          trustStatus: true,
        },
      },
      createdBy: {
        select: { name: true, role: true },
      },
    },
    orderBy: { transactionDate: "desc" },
  });

  // Active debt per customer for this business (missing key = 0).
  const activeDebtByCustomer = await getActiveDebtByCustomer(actor.businessId);

  const transactionItems = transactions.map((tx) => {
    const customerCreditLimit = Number(tx.customer.creditLimit);
    const activeDebt = activeDebtByCustomer.get(tx.customer.id) ?? 0;
    const totalAfter = activeDebt + Number(tx.amount);
    const overLimitBy = Math.max(0, totalAfter - customerCreditLimit);

    return {
      id: tx.id,
      transactionNumber: formatTransactionNumber(
        tx.period,
        tx.sequenceNumber,
        businessPrefix(actor.business?.name)
      ),
      customerName: tx.customer.name,
      customerId: tx.customer.id,
      customerCreditLimit,
      customerRiskScore: tx.customer.riskScore,
      customerTrustStatus: tx.customer.trustStatus,
      amount: Number(tx.amount),
      amountLabel: formatIDR(tx.amount),
      dueDate: tx.dueDate.toISOString(),
      dueDateLabel: dateFormatter.format(tx.dueDate),
      transactionDate: tx.transactionDate.toISOString(),
      transactionDateLabel: dateFormatter.format(tx.transactionDate),
      note: tx.note ?? null,
      creatorName: tx.createdBy?.name ?? null,
      creatorRole: tx.createdBy?.role ?? null,
      activeDebt,
      activeDebtLabel: formatIDR(activeDebt),
      totalAfter,
      totalAfterLabel: formatIDR(totalAfter),
      overLimitBy,
      overLimitByLabel: overLimitBy > 0 ? formatIDR(overLimitBy) : null,
    };
  });

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn">
      <ApprovalManagement transactions={transactionItems} />
    </div>
  );
}
