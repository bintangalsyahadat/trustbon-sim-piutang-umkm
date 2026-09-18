/**
 * Canonical active-debt ("aktif/utang aktif") definition:
 * For a customer, active debt is:
 *   The sum over CONFIRMED transactions of
 *   (transaction.amount − sum of that transaction's CONFIRMED payments),
 *   clamped at 0.
 *
 * Only transactions with paymentStatus "confirmed" AND status "unpaid" or
 * "partial" are included. Draft/cancelled/need_approval transactions and
 * non-confirmed payments are excluded.
 * Customers with no qualifying transactions are absent from the returned
 * Map; callers should treat a missing key as 0.
 */

import { prisma } from "@/lib/prisma";

/**
 * Net outstanding amount of a single transaction.
 *
 * @param {import("@prisma/client").Prisma.Decimal | number} amount
 * @param {Array<{ amountPaid: import("@prisma/client").Prisma.Decimal | number }>} payments
 * @returns {number} the remaining amount, never below 0.
 */
export function netOutstanding(amount, payments) {
  const paid = payments.reduce((sum, p) => sum + Number(p.amountPaid), 0);
  return Math.max(0, Number(amount) - paid);
}

/**
 * Computes active debt per customer for a business.
 *
 * @param {number} businessId
 * @param {number | null} customerId optional single-customer filter.
 * @returns {Promise<Map<number, number>>} Map keyed by customerId. Customers
 * with no qualifying transactions are absent (callers use `?? 0`).
 */
export async function getActiveDebtByCustomer(businessId, customerId = null) {
  const transactions = await prisma.transaction.findMany({
    where: {
      businessId,
      paymentStatus: "confirmed",
      status: { in: ["unpaid", "partial"] },
      ...(customerId != null ? { customerId } : {}),
    },
    select: {
      customerId: true,
      amount: true,
      payments: {
        where: { status: "confirmed" },
        select: { amountPaid: true },
      },
    },
  });

  const debts = new Map();
  for (const tx of transactions) {
    const contribution = netOutstanding(tx.amount, tx.payments);
    debts.set(tx.customerId, (debts.get(tx.customerId) ?? 0) + contribution);
  }
  return debts;
}
