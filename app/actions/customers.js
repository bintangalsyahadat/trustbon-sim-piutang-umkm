"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const NO_SESSION = "Sesi tidak ditemukan. Silakan masuk kembali.";
const ACTOR_NOT_ACTIVE = "Akun Anda tidak aktif.";
const NOT_OWNER = "Hanya pemilik bisnis yang dapat melakukan tindakan ini.";
const NAME_INVALID = "Nama pelanggan wajib diisi (maksimal 100 karakter).";
const PHONE_INVALID = "Nomor HP tidak valid. Gunakan 9–16 digit angka.";
const LIMIT_INVALID = "Limit kredit tidak valid.";

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
  if (actor.role !== "owner") return { ok: false, error: NOT_OWNER };

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
      trustStatus: "recovering",
    },
    select: { id: true },
  });

  revalidatePath("/dashboard/pelanggan");
  return { ok: true, customerId: created.id };
}
