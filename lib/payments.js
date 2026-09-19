/**
 * Server-only payment read helpers.
 *
 * Payment has no businessId of its own: multi-tenant scoping always goes
 * through `payment.transaction.businessId`. Amounts are Prisma Decimal and are
 * converted with Number(...) at this boundary. IDR has no cents.
 */

import { prisma } from "@/lib/prisma";
import { netOutstanding } from "@/lib/customer-debt";
import { businessPrefix, formatTransactionNumber } from "@/lib/format";

/**
 * Recorded payment history for a business, newest first.
 *
 * @param {{ businessId: number, businessName: string }} args
 * @returns {Promise<Array<{
 *   id: number,
 *   customerId: number,
 *   customerName: string,
 *   customerPhone: string,
 *   transactionId: number,
 *   transactionNumber: string,
 *   amountPaid: number,
 *   paymentDate: string,
 *   status: "confirmed" | "cancelled",
 * }>>}
 */
export async function getPaymentHistory({ businessId, businessName } = {}) {
  const payments = await prisma.payment.findMany({
    where: { transaction: { businessId } },
    select: {
      id: true,
      amountPaid: true,
      paymentDate: true,
      status: true,
      transaction: {
        select: {
          id: true,
          period: true,
          sequenceNumber: true,
          customer: { select: { id: true, name: true, phoneNumber: true } },
        },
      },
    },
    orderBy: [{ paymentDate: "desc" }, { id: "desc" }],
  });

  const prefix = businessPrefix(businessName);

  return payments.map((payment) => ({
    id: payment.id,
    customerId: payment.transaction.customer.id,
    customerName: payment.transaction.customer.name,
    customerPhone: payment.transaction.customer.phoneNumber,
    transactionId: payment.transaction.id,
    transactionNumber: formatTransactionNumber(
      payment.transaction.period,
      payment.transaction.sequenceNumber,
      prefix,
    ),
    amountPaid: Number(payment.amountPaid),
    paymentDate: payment.paymentDate.toISOString(),
    status: payment.status,
  }));
}

/**
 * One row per ACTIVE kasbon (payable transaction) in a business — feeds the
 * payment form. Active means paymentStatus "confirmed" and status
 * "unpaid"/"partial", mirroring lib/customer-debt.js.
 *
 * @param {{ businessId: number, businessName: string }} args
 * @returns {Promise<Array<{
 *   transactionId: number,
 *   transactionNumber: string,
 *   customerId: number,
 *   customerName: string,
 *   customerPhone: string,
 *   transactionDate: string,
 *   dueDate: string,
 *   amount: number,
 *   paid: number,
 *   remaining: number,
 * }>>}
 */
export async function getActiveKasbonOptions({ businessId, businessName } = {}) {
  const transactions = await prisma.transaction.findMany({
    where: {
      businessId,
      paymentStatus: "confirmed",
      status: { in: ["unpaid", "partial"] },
    },
    select: {
      id: true,
      period: true,
      sequenceNumber: true,
      transactionDate: true,
      dueDate: true,
      amount: true,
      customer: { select: { id: true, name: true, phoneNumber: true } },
      payments: {
        where: { status: "confirmed" },
        select: { amountPaid: true },
      },
    },
    orderBy: [{ customer: { name: "asc" } }, { transactionDate: "asc" }],
  });

  const prefix = businessPrefix(businessName);

  return transactions.map((tx) => {
    const amount = Number(tx.amount);
    const remaining = netOutstanding(tx.amount, tx.payments);

    return {
      transactionId: tx.id,
      transactionNumber: formatTransactionNumber(
        tx.period,
        tx.sequenceNumber,
        prefix,
      ),
      customerId: tx.customer.id,
      customerName: tx.customer.name,
      customerPhone: tx.customer.phoneNumber,
      transactionDate: tx.transactionDate.toISOString(),
      dueDate: tx.dueDate.toISOString(),
      amount,
      paid: amount - remaining,
      remaining,
    };
  });
}
