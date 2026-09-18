import { prisma } from "@/lib/prisma";

/**
 * Recalculates a customer's riskScore and trustStatus based on their
 * confirmed transaction history.
 *
 * Scoring formula:
 * - Base score: 50
 * - Each confirmed credit tx paid in full: -3 (lower = better)
 * - Each confirmed credit tx unpaid/partial: +5 (higher = worse)
 * - Each cancelled confirmed tx: +4 (penalty for cancellations)
 * - Clamped to 0–100 range.
 *
 * trustStatus mapping:
 * - 0–39 → stable
 * - 40–69 → recovering
 * - 70–100 → at_risk
 *
 * @param {number} customerId
 * @returns {Promise<{ riskScore: number, trustStatus: string }>}
 */
export async function calculateRiskScore(customerId) {
  const transactions = await prisma.transaction.findMany({
    where: {
      customerId,
      paymentStatus: { in: ["confirmed", "cancelled"] },
    },
    select: {
      paymentStatus: true,
      status: true,
    },
  });

  let score = 50;

  for (const tx of transactions) {
    if (tx.paymentStatus === "confirmed") {
      if (tx.status === "paid") {
        score -= 3;
      } else {
        score += 5;
      }
    } else if (tx.paymentStatus === "cancelled") {
      score += 4;
    }
  }

  const riskScore = Math.max(0, Math.min(100, score));

  let trustStatus;
  if (riskScore <= 39) {
    trustStatus = "stable";
  } else if (riskScore <= 69) {
    trustStatus = "recovering";
  } else {
    trustStatus = "at_risk";
  }

  await prisma.customer.update({
    where: { id: customerId },
    data: { riskScore, trustStatus },
  });

  // Record in score history
  await prisma.scoreHistory.create({
    data: { customerId, score: riskScore, trustStatus },
  });

  return { riskScore, trustStatus };
}
