import { prisma } from "@/lib/prisma";
import { computeRiskScore } from "@/lib/risk-score-core";

/**
 * Recalculates and persists a customer's riskScore and trustStatus from their
 * confirmed transaction history (feature 4.4 — Skoring Risiko Kredit).
 *
 * This is a thin Prisma wrapper around the pure `computeRiskScore` core:
 * it fetches the confirmed history, normalizes Prisma `Decimal` values to
 * numbers, applies the no-history SKIP rule, delegates the math, then persists
 * the result atomically.
 *
 * Persistence (inside one `prisma.$transaction`):
 * - update `Customer.riskScore` / `Customer.trustStatus`
 * - append a new append-only `ScoreHistory` row
 *
 * SKIP rule: when the customer has no confirmed transactions, nothing is
 * written and the currently stored `{ riskScore, trustStatus }` is returned.
 * A missing customer returns `{ riskScore: null, trustStatus: null }`.
 *
 * @param {number} customerId
 * @returns {Promise<{ riskScore: number|null, trustStatus: string|null }>}
 */
export async function calculateRiskScore(customerId) {
  const numericCustomerId = Number(customerId);
  if (!Number.isInteger(numericCustomerId)) {
    return { riskScore: null, trustStatus: null };
  }

  const customer = await prisma.customer.findUnique({
    where: { id: numericCustomerId },
    select: {
      id: true,
      creditLimit: true,
      riskScore: true,
      trustStatus: true,
      createdAt: true,
    },
  });
  if (!customer) {
    return { riskScore: null, trustStatus: null };
  }

  const transactions = await prisma.transaction.findMany({
    where: {
      customerId: numericCustomerId,
      paymentStatus: "confirmed",
    },
    select: {
      id: true,
      amount: true,
      dueDate: true,
      transactionDate: true,
      status: true,
      payments: {
        where: { status: "confirmed" },
        select: { id: true, amountPaid: true, paymentDate: true },
      },
    },
  });

  // SKIP case: no confirmed history — leave the customer untouched.
  if (transactions.length === 0) {
    return { riskScore: customer.riskScore, trustStatus: customer.trustStatus };
  }

  // Normalize Prisma Decimal values before handing off to the pure core.
  const normalized = transactions.map((tx) => ({
    id: tx.id,
    amount: Number(tx.amount),
    dueDate: tx.dueDate,
    transactionDate: tx.transactionDate,
    status: tx.status,
    payments: tx.payments.map((payment) => ({
      id: payment.id,
      amountPaid: Number(payment.amountPaid),
      paymentDate: payment.paymentDate,
    })),
  }));

  const { riskScore, trustStatus } = computeRiskScore({
    transactions: normalized,
    creditLimit: Number(customer.creditLimit),
    customerCreatedAt: customer.createdAt,
  });

  await prisma.$transaction([
    prisma.customer.update({
      where: { id: numericCustomerId },
      data: { riskScore, trustStatus },
    }),
    prisma.scoreHistory.create({
      data: { customerId: numericCustomerId, score: riskScore, trustStatus },
    }),
  ]);

  return { riskScore, trustStatus };
}
