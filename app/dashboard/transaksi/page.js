import { prisma } from "@/lib/prisma";
import { requireActiveMember } from "@/lib/session-guards";
import { getActiveDebtByCustomer } from "@/lib/customer-debt";
import { businessPrefix, formatIDR, formatTransactionNumber } from "@/lib/format";
import { TransactionManagement } from "./TransactionManagement";

export const metadata = { title: "Transaksi — TrustBon" };

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function TransaksiPage() {
  const { member } = await requireActiveMember();

  const [transactions, customers, debts] = await Promise.all([
    prisma.transaction.findMany({
      where: { businessId: member.businessId },
      orderBy: [{ period: "desc" }, { sequenceNumber: "desc" }],
      include: {
        customer: { select: { id: true, name: true } },
      },
    }),
    prisma.customer.findMany({
      where: { businessId: member.businessId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        creditLimit: true,
        riskScore: true,
        trustStatus: true,
      },
    }),
    getActiveDebtByCustomer(member.businessId),
  ]);

  const transactionItems = transactions.map((tx) => ({
    id: tx.id,
    sequenceNumber: tx.sequenceNumber,
    period: tx.period,
    transactionNumber: formatTransactionNumber(
      tx.period,
      tx.sequenceNumber,
      businessPrefix(member.business?.name)
    ),
    customerName: tx.customer.name,
    customerId: tx.customer.id,
    amount: Number(tx.amount),
    amountLabel: formatIDR(tx.amount),
    dueDate: tx.dueDate.toISOString(),
    dueDateLabel: dateFormatter.format(tx.dueDate),
    transactionDate: tx.transactionDate.toISOString(),
    transactionDateLabel: dateFormatter.format(tx.transactionDate),
    paymentStatus: tx.paymentStatus,
    status: tx.status,
    note: tx.note ?? null,
    cancelledNote: tx.cancelledNote ?? null,
  }));

  const customerItems = customers.map((c) => ({
    id: c.id,
    name: c.name,
    phoneNumber: c.phoneNumber,
    creditLimit: Number(c.creditLimit),
    activeDebt: debts.get(c.id) ?? 0,
    riskScore: c.riskScore,
    trustStatus: c.trustStatus,
  }));

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn">
      <TransactionManagement
        transactions={transactionItems}
        customers={customerItems}
        userRole={member.role}
      />
    </div>
  );
}
