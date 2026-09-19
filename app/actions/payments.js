"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { netOutstanding } from "@/lib/customer-debt";
import { calculateRiskScore } from "@/lib/risk-score";
import { formatIDR } from "@/lib/format";

const NO_SESSION = "Sesi tidak ditemukan. Silakan masuk kembali.";
const ACTOR_NOT_ACTIVE = "Akun Anda tidak aktif.";
const NOT_AUTHORIZED = "Hanya pemilik atau kasir yang dapat melakukan tindakan ini.";
const TX_NOT_FOUND = "Kasbon tidak ditemukan.";
const TX_NOT_CONFIRMED = "Kasbon belum dikonfirmasi sehingga belum bisa dibayar.";
const TX_ALREADY_PAID = "Kasbon ini sudah lunas.";
const AMOUNT_INVALID = "Jumlah pembayaran harus lebih dari 0.";
const GENERIC_ERROR = "Gagal menyimpan pembayaran. Silakan coba lagi.";
const CONCURRENT_PAYMENT = "Pembayaran lain sedang diproses. Silakan coba lagi.";

async function getActor() {
  const session = await auth();
  const actorId = Number(session?.user?.id);
  if (!Number.isInteger(actorId)) return null;
  return prisma.user.findUnique({
    where: { id: actorId },
    select: { id: true, role: true, status: true, businessId: true },
  });
}

/**
 * Records a confirmed payment against a confirmed, not-yet-paid kasbon.
 * Both owner and cashier may record payments.
 *
 * Concurrency: the read-validate-write cycle runs inside one interactive
 * transaction at Serializable isolation. Postgres aborts the losing writer
 * with a serialization failure (P2034) instead of letting two payments
 * over-pay the same kasbon; that loser is reported as CONCURRENT_PAYMENT.
 *
 * riskScore/trustStatus are best-effort post-commit scoring: they are null
 * when scoring failed even though the payment itself committed successfully.
 *
 * @param {{ transactionId: number|string, amountPaid: number|string }} args
 * @returns {Promise<
 *   { ok: true, paymentId: number, transactionId: number, transactionStatus: "unpaid"|"partial"|"paid", customerId: number, riskScore: number|null, trustStatus: string|null }
 * | { ok: false, error: string }
 * >}
 */
export async function createPayment({ transactionId, amountPaid } = {}) {
  const actor = await getActor();
  if (!actor) return { ok: false, error: NO_SESSION };
  if (actor.status !== "active") return { ok: false, error: ACTOR_NOT_ACTIVE };
  if (!["owner", "cashier"].includes(actor.role)) {
    return { ok: false, error: NOT_AUTHORIZED };
  }

  const numericTxId = Number(transactionId);
  if (!Number.isInteger(numericTxId)) {
    return { ok: false, error: TX_NOT_FOUND };
  }

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      // IDOR guard: a transaction from another business resolves to the same
      // not-found message so cross-tenant existence is never revealed.
      const txn = await tx.transaction.findFirst({
        where: { id: numericTxId, businessId: actor.businessId },
        select: {
          id: true,
          customerId: true,
          amount: true,
          paymentStatus: true,
          status: true,
          payments: {
            where: { status: "confirmed" },
            select: { amountPaid: true },
          },
        },
      });
      if (!txn) return { ok: false, error: TX_NOT_FOUND };
      if (txn.paymentStatus !== "confirmed") {
        return { ok: false, error: TX_NOT_CONFIRMED };
      }
      if (txn.status === "paid") {
        return { ok: false, error: TX_ALREADY_PAID };
      }

      const numericAmount = Number(amountPaid);
      const roundedAmount = Math.round(numericAmount);
      if (!Number.isFinite(numericAmount) || roundedAmount <= 0) {
        return { ok: false, error: AMOUNT_INVALID };
      }

      const remaining = netOutstanding(txn.amount, txn.payments);
      if (roundedAmount > remaining) {
        return {
          ok: false,
          error: `Jumlah pembayaran melebihi sisa utang (${formatIDR(remaining)}).`,
        };
      }

      const payment = await tx.payment.create({
        data: {
          transactionId: txn.id,
          amountPaid: roundedAmount,
          status: "confirmed",
        },
        select: { id: true },
      });

      // Recompute progress from ALL confirmed payments, including the one just
      // created, so concurrent writers settle on the same state.
      const confirmedPayments = await tx.payment.findMany({
        where: { transactionId: txn.id, status: "confirmed" },
        select: { amountPaid: true },
      });
      const paidTotal = confirmedPayments.reduce(
        (sum, item) => sum + Number(item.amountPaid),
        0,
      );
      const transactionStatus =
        paidTotal >= Number(txn.amount)
          ? "paid"
          : paidTotal > 0
            ? "partial"
            : "unpaid";

      await tx.transaction.update({
        where: { id: txn.id },
        data: { status: transactionStatus },
      });

      return {
        ok: true,
        paymentId: payment.id,
        transactionId: txn.id,
        transactionStatus,
        customerId: txn.customerId,
      };
    }, { isolationLevel: "Serializable" });

    if (!outcome.ok) return outcome;

    // Best-effort scoring AFTER commit: calculateRiskScore uses the global
    // prisma client (it must not run inside the $transaction). A scoring
    // failure must NOT fail the action — the Payment and Transaction update
    // are already committed, so returning an error would trigger a double-pay
    // retry. Null signals "recompute later".
    let riskScore = null;
    let trustStatus = null;
    try {
      ({ riskScore, trustStatus } = await calculateRiskScore(
        outcome.customerId,
      ));
    } catch (err) {
      console.error("calculateRiskScore failed after payment commit:", err);
    }

    revalidatePath("/dashboard/pembayaran");
    revalidatePath("/dashboard/transaksi");
    revalidatePath("/dashboard/pelanggan");

    return {
      ok: true,
      paymentId: outcome.paymentId,
      transactionId: outcome.transactionId,
      transactionStatus: outcome.transactionStatus,
      customerId: outcome.customerId,
      riskScore,
      trustStatus,
    };
  } catch (err) {
    // Serializable isolation aborts the losing concurrent writer (P2034).
    if (err?.code === "P2034") {
      return { ok: false, error: CONCURRENT_PAYMENT };
    }
    return { ok: false, error: GENERIC_ERROR };
  }
}
