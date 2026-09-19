"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { netOutstanding } from "@/lib/customer-debt";
import { calculateRiskScore } from "@/lib/risk-score";

const NO_SESSION = "Sesi tidak ditemukan. Silakan masuk kembali.";
const ACTOR_NOT_ACTIVE = "Akun Anda tidak aktif.";
const NOT_AUTHORIZED = "Hanya pemilik atau kasir yang dapat melakukan tindakan ini.";
const CUSTOMER_NOT_FOUND = "Pelanggan tidak ditemukan.";
const TX_NOT_FOUND = "Transaksi tidak ditemukan.";
const TX_NOT_EDITABLE = "Transaksi ini tidak dapat diedit.";
const TX_NOT_DELETABLE = "Transaksi ini tidak dapat dihapus.";
const AMOUNT_INVALID = "Nominal transaksi harus lebih dari 0.";
const DUE_DATE_INVALID = "Tanggal jatuh tempo tidak valid.";
const TX_ALREADY_SETTLED = "Transaksi yang sudah lunas tidak dapat dibatalkan.";
const TX_HAS_PAYMENT =
  "Transaksi yang sudah memiliki pembayaran tidak dapat dibatalkan.";

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
 * Creates a credit transaction scoped to the actor's business.
 * Auto-confirms at creation: within limit → confirmed, over limit → need_approval.
 * Assigns a per-month sequence number (period YYYYMM); the counter resets each month.
 *
 * @returns {Promise<{ ok: true, transactionId: number } | { ok: false, error: string }>}
 */
export async function createTransaction({ customerId, amount, dueDate, note } = {}) {
  const actor = await getActor();
  if (!actor) return { ok: false, error: NO_SESSION };
  if (actor.status !== "active") return { ok: false, error: ACTOR_NOT_ACTIVE };
  if (!["owner", "cashier"].includes(actor.role)) {
    return { ok: false, error: NOT_AUTHORIZED };
  }

  const numericCustomerId = Number(customerId);
  if (!Number.isInteger(numericCustomerId)) {
    return { ok: false, error: CUSTOMER_NOT_FOUND };
  }

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return { ok: false, error: AMOUNT_INVALID };
  }

  const parsedDue = dueDate ? new Date(dueDate) : null;
  if (!parsedDue || !Number.isFinite(parsedDue.getTime())) {
    return { ok: false, error: DUE_DATE_INVALID };
  }

  const customer = await prisma.customer.findFirst({
    where: { id: numericCustomerId, businessId: actor.businessId },
    select: { id: true },
  });
  if (!customer) return { ok: false, error: CUSTOMER_NOT_FOUND };

  const cleanNote = (note ?? "").trim() || null;

  // Auto-confirm: check credit limit at creation
  const customerFull = await prisma.customer.findFirst({
    where: { id: numericCustomerId, businessId: actor.businessId },
    select: { id: true, creditLimit: true },
  });
  if (!customerFull) return { ok: false, error: CUSTOMER_NOT_FOUND };

  // Include need_approval transactions in the limit check
  const activeTx = await prisma.transaction.findMany({
    where: {
      businessId: actor.businessId,
      customerId: numericCustomerId,
      paymentStatus: { in: ["confirmed", "need_approval"] },
      status: { in: ["unpaid", "partial"] },
    },
    select: {
      amount: true,
      payments: {
        where: { status: "confirmed" },
        select: { amountPaid: true },
      },
    },
  });

  let activeDebt = 0;
  for (const atx of activeTx) {
    activeDebt += netOutstanding(atx.amount, atx.payments);
  }

  const creditLimit = Number(customerFull.creditLimit);
  const totalAfter = activeDebt + Math.round(numericAmount);
  const initialStatus = totalAfter > creditLimit ? "need_approval" : "confirmed";

  // Check if customer has pending need_approval transactions
  const pendingCount = await prisma.transaction.count({
    where: {
      businessId: actor.businessId,
      customerId: numericCustomerId,
      paymentStatus: "need_approval",
    },
  });

  // Monthly numbering period: YYYYMM (sequence resets each month)
  const now = new Date();
  const period = now.getFullYear() * 100 + (now.getMonth() + 1);

  // Allocate the next per-month sequence, retrying on unique-constraint races.
  let created = null;
  let nextSequence = 1;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const lastTx = await prisma.transaction.findFirst({
      where: { businessId: actor.businessId, period },
      orderBy: { sequenceNumber: "desc" },
      select: { sequenceNumber: true },
    });
    nextSequence = (lastTx?.sequenceNumber ?? 0) + 1;
    try {
      created = await prisma.transaction.create({
        data: {
          businessId: actor.businessId,
          customerId: numericCustomerId,
          period,
          sequenceNumber: nextSequence,
          amount: Math.round(numericAmount),
          dueDate: parsedDue,
          paymentStatus: initialStatus,
          status: "unpaid",
          note: cleanNote,
          createdById: actor.id,
        },
        select: { id: true },
      });
      break;
    } catch (err) {
      const isUniqueViolation = err?.code === "P2002";
      if (!isUniqueViolation || attempt === 2) throw err;
    }
  }

  revalidatePath("/dashboard/transaksi");
  revalidatePath("/dashboard/approval");
  return {
    ok: true,
    transactionId: created.id,
    paymentStatus: initialStatus,
    pendingApprovalCount: pendingCount,
  };
}

/**
 * Edits a draft transaction (only editable when paymentStatus = "draft").
 * Both owner and cashier can edit drafts.
 *
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
export async function updateTransaction({ transactionId, amount, dueDate, note } = {}) {
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

  const tx = await prisma.transaction.findFirst({
    where: {
      id: numericTxId,
      businessId: actor.businessId,
    },
    select: { id: true, paymentStatus: true },
  });
  if (!tx) return { ok: false, error: TX_NOT_FOUND };
  if (tx.paymentStatus !== "draft") return { ok: false, error: TX_NOT_EDITABLE };

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return { ok: false, error: AMOUNT_INVALID };
  }

  const parsedDue = dueDate ? new Date(dueDate) : null;
  if (!parsedDue || !Number.isFinite(parsedDue.getTime())) {
    return { ok: false, error: DUE_DATE_INVALID };
  }

  const cleanNote = (note ?? "").trim() || null;

  await prisma.transaction.update({
    where: { id: numericTxId },
    data: {
      amount: Math.round(numericAmount),
      dueDate: parsedDue,
      note: cleanNote,
    },
  });

  revalidatePath("/dashboard/transaksi");
  return { ok: true };
}

/**
 * Hard-deletes a draft transaction. Only drafts can be deleted.
 * Both owner and cashier can delete drafts.
 *
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
export async function deleteTransaction({ transactionId } = {}) {
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

  const tx = await prisma.transaction.findFirst({
    where: {
      id: numericTxId,
      businessId: actor.businessId,
    },
    select: { id: true, paymentStatus: true },
  });
  if (!tx) return { ok: false, error: TX_NOT_FOUND };
  if (tx.paymentStatus !== "draft") return { ok: false, error: TX_NOT_DELETABLE };

  await prisma.transaction.delete({ where: { id: numericTxId } });

  revalidatePath("/dashboard/transaksi");
  return { ok: true };
}

/**
 * Confirms a draft transaction: transitions paymentStatus from "draft" to
 * either "confirmed" or "need_approval" depending on credit limit check.
 * Both owner and cashier can confirm.
 *
 * @returns {Promise<{ ok: true, paymentStatus: string } | { ok: false, error: string }>}
 */
export async function confirmTransaction({ transactionId } = {}) {
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

  const tx = await prisma.transaction.findFirst({
    where: {
      id: numericTxId,
      businessId: actor.businessId,
    },
    select: {
      id: true,
      paymentStatus: true,
      customerId: true,
      amount: true,
    },
  });
  if (!tx) return { ok: false, error: TX_NOT_FOUND };
  if (tx.paymentStatus !== "draft") return { ok: false, error: TX_NOT_EDITABLE };

  // Check credit limit
  const customer = await prisma.customer.findFirst({
    where: { id: tx.customerId, businessId: actor.businessId },
    select: { id: true, creditLimit: true },
  });
  if (!customer) return { ok: false, error: CUSTOMER_NOT_FOUND };

  const activeTransactions = await prisma.transaction.findMany({
    where: {
      businessId: actor.businessId,
      customerId: tx.customerId,
      paymentStatus: "confirmed",
      status: { in: ["unpaid", "partial"] },
    },
    select: {
      amount: true,
      payments: {
        where: { status: "confirmed" },
        select: { amountPaid: true },
      },
    },
  });

  let activeDebt = 0;
  for (const atx of activeTransactions) {
    activeDebt += netOutstanding(atx.amount, atx.payments);
  }
  const creditLimit = Number(customer.creditLimit);
  const totalAfter = activeDebt + Number(tx.amount);
  const newPaymentStatus = totalAfter > creditLimit ? "need_approval" : "confirmed";

  await prisma.transaction.update({
    where: { id: numericTxId },
    data: { paymentStatus: newPaymentStatus },
  });

  revalidatePath("/dashboard/transaksi");
  revalidatePath("/dashboard/approval");
  return { ok: true, paymentStatus: newPaymentStatus };
}

/**
 * Cancels a confirmed transaction (owner-only). Sets paymentStatus to
 * "cancelled" and records the reason in the "note" field.
 * Recalculates the customer's risk score afterward.
 *
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
export async function cancelTransaction({ transactionId, note } = {}) {
  const actor = await getActor();
  if (!actor) return { ok: false, error: NO_SESSION };
  if (actor.status !== "active") return { ok: false, error: ACTOR_NOT_ACTIVE };
  if (actor.role !== "owner") {
    return { ok: false, error: "Hanya pemilik yang dapat membatalkan transaksi." };
  }

  const numericTxId = Number(transactionId);
  if (!Number.isInteger(numericTxId)) {
    return { ok: false, error: TX_NOT_FOUND };
  }

  const tx = await prisma.transaction.findFirst({
    where: {
      id: numericTxId,
      businessId: actor.businessId,
    },
    select: {
      id: true,
      paymentStatus: true,
      customerId: true,
      status: true,
      amount: true,
      payments: {
        where: { status: "confirmed" },
        select: { amountPaid: true },
      },
    },
  });
  if (!tx) return { ok: false, error: TX_NOT_FOUND };
  if (tx.paymentStatus !== "confirmed") {
    return { ok: false, error: "Hanya transaksi terkonfirmasi yang dapat dibatalkan." };
  }

  // A kasbon with any confirmed payment (partial or settled) must never be
  // cancellable. Settled is derived from the payment data, not only tx.status,
  // so a drifted status column cannot bypass the money rule.
  const paidTotal = tx.payments.reduce(
    (sum, payment) => sum + Number(payment.amountPaid),
    0,
  );
  if (paidTotal > 0) {
    const settled = tx.status === "paid" || paidTotal >= Number(tx.amount);
    return { ok: false, error: settled ? TX_ALREADY_SETTLED : TX_HAS_PAYMENT };
  }

  const cleanNote = (note ?? "").trim();
  if (!cleanNote) {
    return { ok: false, error: "Alasan pembatalan wajib diisi." };
  }

  await prisma.transaction.update({
    where: { id: numericTxId },
    data: {
      paymentStatus: "cancelled",
      cancelledNote: cleanNote,
    },
  });

  // Recalculate risk score after cancellation. Best-effort: the cancellation
  // is already committed, so a scoring failure must not fail the action.
  try {
    await calculateRiskScore(tx.customerId);
  } catch (err) {
    console.error("calculateRiskScore failed after cancellation:", err);
  }

  revalidatePath("/dashboard/transaksi");
  revalidatePath("/dashboard/pelanggan");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Approves a need_approval transaction (owner-only).
 *
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
export async function approveTransaction({ transactionId } = {}) {
  const actor = await getActor();
  if (!actor) return { ok: false, error: NO_SESSION };
  if (actor.status !== "active") return { ok: false, error: ACTOR_NOT_ACTIVE };
  if (actor.role !== "owner") {
    return { ok: false, error: "Hanya pemilik yang dapat menyetujui transaksi." };
  }

  const numericTxId = Number(transactionId);
  if (!Number.isInteger(numericTxId)) {
    return { ok: false, error: TX_NOT_FOUND };
  }

  const tx = await prisma.transaction.findFirst({
    where: {
      id: numericTxId,
      businessId: actor.businessId,
    },
    select: { id: true, paymentStatus: true },
  });
  if (!tx) return { ok: false, error: TX_NOT_FOUND };
  if (tx.paymentStatus !== "need_approval") {
    return { ok: false, error: "Transaksi ini tidak menunggu persetujuan." };
  }

  await prisma.transaction.update({
    where: { id: numericTxId },
    data: { paymentStatus: "confirmed" },
  });

  revalidatePath("/dashboard/transaksi");
  revalidatePath("/dashboard/approval");
  return { ok: true };
}

/**
 * Rejects a need_approval transaction (owner-only).
 *
 * No payment guard is needed here: only need_approval transactions are acted on,
 * and payments can only be recorded against confirmed transactions by construction.
 *
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
export async function rejectTransaction({ transactionId, note } = {}) {
  const actor = await getActor();
  if (!actor) return { ok: false, error: NO_SESSION };
  if (actor.status !== "active") return { ok: false, error: ACTOR_NOT_ACTIVE };
  if (actor.role !== "owner") {
    return { ok: false, error: "Hanya pemilik yang dapat menolak transaksi." };
  }

  const numericTxId = Number(transactionId);
  if (!Number.isInteger(numericTxId)) {
    return { ok: false, error: TX_NOT_FOUND };
  }

  const tx = await prisma.transaction.findFirst({
    where: {
      id: numericTxId,
      businessId: actor.businessId,
    },
    select: { id: true, paymentStatus: true, customerId: true },
  });
  if (!tx) return { ok: false, error: TX_NOT_FOUND };
  if (tx.paymentStatus !== "need_approval") {
    return { ok: false, error: "Transaksi ini tidak menunggu persetujuan." };
  }

  const cleanNote = (note ?? "").trim();
  if (!cleanNote) {
    return { ok: false, error: "Alasan penolakan wajib diisi." };
  }

  await prisma.transaction.update({
    where: { id: numericTxId },
    data: {
      paymentStatus: "cancelled",
      cancelledNote: cleanNote,
    },
  });

  // Best-effort risk score recalculation after rejection: the rejection is
  // already committed, so a scoring failure must not fail the action.
  try {
    await calculateRiskScore(tx.customerId);
  } catch (err) {
    console.error("calculateRiskScore failed after rejection:", err);
  }

  revalidatePath("/dashboard/transaksi");
  revalidatePath("/dashboard/approval");
  revalidatePath("/dashboard/pelanggan");
  return { ok: true };
}

