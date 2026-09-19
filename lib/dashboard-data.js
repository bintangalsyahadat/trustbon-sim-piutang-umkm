/**
 * Real Prisma-backed data layer for the role-based dashboards.
 *
 * Replaces lib/dashboard-dummy.js — same getter names, same plain-serializable
 * output contract, but now backed by live DB queries scoped to businessId.
 *
 * All exported values are plain numbers / strings / arrays (no Decimal, no Date
 * objects). Formatting helpers live in lib/format.js.
 */

import { prisma } from "@/lib/prisma";
import { getActiveDebtByCustomer } from "@/lib/customer-debt";

/**
 * Cashier dashboard: today's activity at a glance.
 *
 * @param {number} businessId
 * @returns {Promise<{
 *   todayTransactionCount: number,
 *   todayNewCreditTotal: number,
 *   todayPaymentsReceived: number,
 *   recentTransactions: Array<{
 *     id: number,
 *     sequenceNumber: number,
 *     customerName: string,
 *     amount: number,
 *     paymentStatus: string,
 *   }>,
 * }>}
 */
export async function getCashierDashboardData(businessId) {
  // Server-local day boundaries.
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const [countResult, creditSumResult, paymentSumResult, recentRaw] =
    await Promise.all([
      prisma.transaction.count({
        where: {
          businessId,
          transactionDate: { gte: start, lt: end },
          paymentStatus: { in: ["confirmed", "need_approval"] },
        },
      }),
      prisma.transaction.aggregate({
        where: {
          businessId,
          transactionDate: { gte: start, lt: end },
          paymentStatus: "confirmed",
        },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: {
          transaction: { businessId },
          status: "confirmed",
          paymentDate: { gte: start, lt: end },
        },
        _sum: { amountPaid: true },
      }),
      prisma.transaction.findMany({
        where: { businessId },
        orderBy: [{ transactionDate: "desc" }, { id: "desc" }],
        take: 5,
        select: {
          id: true,
          sequenceNumber: true,
          amount: true,
          paymentStatus: true,
          customer: { select: { name: true } },
        },
      }),
    ]);

  return {
    todayTransactionCount: countResult,
    todayNewCreditTotal: Number(creditSumResult._sum.amount ?? 0),
    todayPaymentsReceived: Number(paymentSumResult._sum.amountPaid ?? 0),
    recentTransactions: recentRaw.map((tx) => ({
      id: tx.id,
      sequenceNumber: tx.sequenceNumber,
      customerName: tx.customer.name,
      amount: Number(tx.amount),
      paymentStatus: tx.paymentStatus,
    })),
  };
}

/**
 * Owner dashboard: business-level health metrics.
 *
 * @param {number} businessId
 * @returns {Promise<{
 *   totalActiveReceivables: number,
 *   activeCustomers: number,
 *   highRiskCustomers: number,
 *   onTimePaymentPercent: number | null,
 *   attention: Array<{
 *     id: number,
 *     customerName: string,
 *     outstandingAmount: number,
 *     riskScore: number,
 *     trustStatus: string,
 *   }>,
 * }>}
 */
export async function getOwnerDashboardData(businessId) {
  const [customers, debts, paidTx] = await Promise.all([
    prisma.customer.findMany({
      where: { businessId },
      select: { id: true, name: true, riskScore: true, trustStatus: true },
    }),
    getActiveDebtByCustomer(businessId),
    prisma.transaction.findMany({
      where: { businessId, paymentStatus: "confirmed", status: "paid" },
      select: {
        dueDate: true,
        payments: {
          where: { status: "confirmed" },
          select: { paymentDate: true },
          orderBy: { paymentDate: "desc" },
        },
      },
    }),
  ]);

  // Total active receivables: sum of canonical active debt across customers.
  const totalActiveReceivables = [...debts.values()].reduce(
    (sum, v) => sum + v,
    0,
  );

  const activeCustomers = customers.length;
  const highRiskCustomers = customers.filter(
    (c) => c.trustStatus === "at_risk",
  ).length;

  // On-time payment %: among confirmed+paid transactions, what fraction had
  // their newest confirmed payment on or before the due date?
  let onTimePaymentPercent = null;
  if (paidTx.length > 0) {
    let onTime = 0;
    for (const tx of paidTx) {
      const lastPaymentDate = tx.payments[0]?.paymentDate;
      if (lastPaymentDate && lastPaymentDate <= tx.dueDate) {
        onTime++;
      }
    }
    onTimePaymentPercent = (onTime / paidTx.length) * 100;
  }

  // "Perlu perhatian": recovering/at_risk customers, sorted by active debt desc.
  const attention = customers
    .filter((c) => c.trustStatus === "recovering" || c.trustStatus === "at_risk")
    .map((c) => ({
      id: c.id,
      customerName: c.name,
      outstandingAmount: debts.get(c.id) ?? 0,
      riskScore: c.riskScore,
      trustStatus: c.trustStatus,
    }))
    .sort((a, b) => b.outstandingAmount - a.outstandingAmount)
    .slice(0, 5);

  return {
    totalActiveReceivables,
    activeCustomers,
    highRiskCustomers,
    onTimePaymentPercent,
    attention,
  };
}
