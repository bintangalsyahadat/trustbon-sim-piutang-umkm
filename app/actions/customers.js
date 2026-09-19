"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveDebtByCustomer } from "@/lib/customer-debt";

const NO_SESSION = "Sesi tidak ditemukan. Silakan masuk kembali.";
const ACTOR_NOT_ACTIVE = "Akun Anda tidak aktif.";
const NOT_AUTHORIZED = "Hanya pemilik atau kasir yang dapat melakukan tindakan ini.";
const OWNER_ONLY = "Hanya pemilik bisnis yang dapat melakukan tindakan ini.";
const CUSTOMER_NOT_FOUND = "Pelanggan tidak ditemukan.";
const NAME_INVALID = "Nama pelanggan wajib diisi (maksimal 100 karakter).";
const PHONE_INVALID = "Nomor HP tidak valid. Gunakan 9–16 digit angka.";
const LIMIT_INVALID = "Limit kredit tidak valid.";
const CUSTOMER_HAS_DEBT = "Pelanggan masih memiliki utang aktif dan tidak dapat dihapus.";
const CUSTOMER_HAS_HISTORY =
  "Pelanggan tidak dapat dihapus karena masih memiliki riwayat transaksi.";

/** Reads the signed-in actor from the session, or null when not signed in. */
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
 * Creates a customer scoped to the signed-in owner's business. All guards and
 * validation run before any mutation.
 *
 * @returns {Promise<{ ok: true, customerId: number } | { ok: false, error: string }>}
 */
export async function createCustomer({ name, phoneNumber, creditLimit } = {}) {
  const actor = await getActor();
  if (!actor) return { ok: false, error: NO_SESSION };
  if (actor.status !== "active") return { ok: false, error: ACTOR_NOT_ACTIVE };
  if (!["owner", "cashier"].includes(actor.role)) return { ok: false, error: NOT_AUTHORIZED };

  const cleanName = String(name ?? "").trim();
  if (cleanName.length === 0 || cleanName.length > 100) {
    return { ok: false, error: NAME_INVALID };
  }

  // Normalize the phone number (strip spaces/dashes) before validating.
  const cleanPhone = String(phoneNumber ?? "")
    .trim()
    .replace(/[\s-]/g, "");
  if (!/^[0-9+][0-9]{7,15}$/.test(cleanPhone)) {
    return { ok: false, error: PHONE_INVALID };
  }

  const limitNumber = Number(creditLimit);
  if (
    !Number.isFinite(limitNumber) ||
    limitNumber < 0 ||
    limitNumber > 1_000_000_000
  ) {
    return { ok: false, error: LIMIT_INVALID };
  }

  const created = await prisma.customer.create({
    data: {
      businessId: actor.businessId,
      name: cleanName,
      phoneNumber: cleanPhone,
      creditLimit: Math.round(limitNumber),
      riskScore: 50,
      trustStatus: "unrated",
    },
    select: { id: true },
  });

  revalidatePath("/dashboard/pelanggan");
  return { ok: true, customerId: created.id };
}

/**
 * Updates a customer scoped to the signed-in owner's business.
 * Only the owner can edit customers.
 */
export async function updateCustomer({ id, name, phoneNumber, creditLimit } = {}) {
  const actor = await getActor();
  if (!actor) return { ok: false, error: NO_SESSION };
  if (actor.status !== "active") return { ok: false, error: ACTOR_NOT_ACTIVE };
  if (actor.role !== "owner") return { ok: false, error: OWNER_ONLY };

  const customerId = Number(id);
  if (!Number.isInteger(customerId)) {
    return { ok: false, error: CUSTOMER_NOT_FOUND };
  }

  const cleanName = String(name ?? "").trim();
  if (cleanName.length === 0 || cleanName.length > 100) {
    return { ok: false, error: NAME_INVALID };
  }

  const cleanPhone = String(phoneNumber ?? "")
    .trim()
    .replace(/[\s-]/g, "");
  if (!/^[0-9+][0-9]{7,15}$/.test(cleanPhone)) {
    return { ok: false, error: PHONE_INVALID };
  }

  const limitNumber = Number(creditLimit);
  if (
    !Number.isFinite(limitNumber) ||
    limitNumber < 0 ||
    limitNumber > 1_000_000_000
  ) {
    return { ok: false, error: LIMIT_INVALID };
  }

  try {
    await prisma.customer.update({
      where: { id: customerId, businessId: actor.businessId },
      data: {
        name: cleanName,
        phoneNumber: cleanPhone,
        creditLimit: Math.round(limitNumber),
      },
    });
  } catch {
    return { ok: false, error: CUSTOMER_NOT_FOUND };
  }

  revalidatePath("/dashboard/pelanggan");
  revalidatePath(`/dashboard/pelanggan/${customerId}`);
  return { ok: true };
}

/**
 * Deletes a customer when they have no active debt. Only the owner can delete.
 *
 * The schema relations are restrict-by-default (no database cascade), so the
 * delete still fails when the customer has any surviving transaction history;
 * that financial history is intentionally retained and never deleted here.
 */
export async function deleteCustomer({ id } = {}) {
  const actor = await getActor();
  if (!actor) return { ok: false, error: NO_SESSION };
  if (actor.status !== "active") return { ok: false, error: ACTOR_NOT_ACTIVE };
  if (actor.role !== "owner") return { ok: false, error: OWNER_ONLY };

  const customerId = Number(id);
  if (!Number.isInteger(customerId)) {
    return { ok: false, error: CUSTOMER_NOT_FOUND };
  }

  // Canonical active-debt check: confirmed transactions (unpaid/partial) minus
  // their confirmed payments.
  const debts = await getActiveDebtByCustomer(actor.businessId, customerId);
  const owed = debts.get(customerId) ?? 0;
  if (owed > 0) {
    return { ok: false, error: CUSTOMER_HAS_DEBT };
  }

  try {
    await prisma.customer.delete({
      where: { id: customerId, businessId: actor.businessId },
    });
  } catch (err) {
    // P2003 = foreign-key/constraint violation (surviving history).
    if (err?.code === "P2003") {
      return { ok: false, error: CUSTOMER_HAS_HISTORY };
    }
    return { ok: false, error: CUSTOMER_NOT_FOUND };
  }

  revalidatePath("/dashboard/pelanggan");
  return { ok: true };
}
