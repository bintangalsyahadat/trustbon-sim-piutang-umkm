import { ClipboardCheck } from "lucide-react";
import { requireOwner } from "@/lib/session-guards";
import { prisma } from "@/lib/prisma";
import { businessPrefix, formatIDR, formatTransactionNumber } from "@/lib/format";
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
    },
    orderBy: { transactionDate: "desc" },
  });

  const transactionItems = transactions.map((tx) => ({
    id: tx.id,
    transactionNumber: formatTransactionNumber(
      tx.period,
      tx.sequenceNumber,
      businessPrefix(actor.business?.name)
    ),
    customerName: tx.customer.name,
    customerId: tx.customer.id,
    customerCreditLimit: Number(tx.customer.creditLimit),
    customerRiskScore: tx.customer.riskScore,
    customerTrustStatus: tx.customer.trustStatus,
    amount: Number(tx.amount),
    amountLabel: formatIDR(tx.amount),
    dueDate: tx.dueDate.toISOString(),
    dueDateLabel: dateFormatter.format(tx.dueDate),
    transactionDate: tx.transactionDate.toISOString(),
    transactionDateLabel: dateFormatter.format(tx.transactionDate),
    note: tx.note ?? null,
  }));

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn">
      <ApprovalManagement transactions={transactionItems} />
    </div>
  );
}
