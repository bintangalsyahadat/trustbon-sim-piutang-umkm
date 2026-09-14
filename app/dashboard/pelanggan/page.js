import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/session-guards";
import { getActiveDebtByCustomer } from "@/lib/customer-debt";
import { CustomerManagement } from "./CustomerManagement";

export const metadata = { title: "Pelanggan — TrustBon" };

export default async function PelangganPage() {
  const { member } = await requireOwner();

  const [customers, debts] = await Promise.all([
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

  // Plain serializable props — no Decimal, Date, or Map across the boundary.
  const items = customers.map((customer) => ({
    id: customer.id,
    name: customer.name,
    phoneNumber: customer.phoneNumber,
    creditLimit: Number(customer.creditLimit),
    riskScore: customer.riskScore,
    trustStatus: customer.trustStatus,
    activeDebt: debts.get(customer.id) ?? 0,
  }));

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn">
      <CustomerManagement customers={items} />
    </div>
  );
}
