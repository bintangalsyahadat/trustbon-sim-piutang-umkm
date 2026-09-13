"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateUniqueInviteCode } from "@/lib/invite-code";

const NO_SESSION = "Sesi tidak ditemukan. Silakan masuk kembali.";
const ALREADY_ACTIVE =
  "Akun Anda sudah aktif dan tidak dapat melakukan onboarding ulang.";
const BUSINESS_FIELDS =
  "Nama bisnis, nama pemilik, dan nomor telepon wajib diisi.";
const MAX_INVITE_ATTEMPTS = 3;

/**
 * Resume onboarding for a signed-in user whose status is not "active". They no
 * longer hold the 30-minute registration cookie, so the cookie-based actions in
 * app/actions/auth.js cannot serve them.
 */
async function getCurrentUser() {
  const session = await auth();
  const userId = Number(session?.user?.id);
  if (!Number.isInteger(userId)) return null;
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      businessId: true,
    },
  });
}

/**
 * Removes still-unread `join_request` notifications that were addressed to the
 * user's former owner(s) about this user. Prevents the old owner from being shown
 * a request the user has already replaced.
 */
async function deleteStaleJoinRequests(tx, email, formerBusinessId) {
  const formerOwners = await tx.user.findMany({
    where: { businessId: formerBusinessId, role: "owner" },
    select: { id: true },
  });
  if (formerOwners.length === 0) return;

  await tx.notification.deleteMany({
    where: {
      userId: { in: formerOwners.map((owner) => owner.id) },
      type: "join_request",
      readAt: null,
      body: email,
    },
  });
}

/** Moves the signed-in user into another business as a pending cashier. */
export async function resubmitJoinAsCashier({ inviteCode }) {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: NO_SESSION };
  if (me.status === "active") return { ok: false, error: ALREADY_ACTIVE };

  const code = inviteCode?.toString().trim().toUpperCase();
  if (!code) return { ok: false, error: "Kode undangan wajib diisi." };

  const business = await prisma.business.findUnique({
    where: { inviteCode: code },
  });
  if (!business) return { ok: false, error: "Kode undangan tidak valid." };

  await prisma.$transaction(async (tx) => {
    await deleteStaleJoinRequests(tx, me.email, me.businessId);

    await tx.user.update({
      where: { id: me.id },
      data: { businessId: business.id, role: "cashier", status: "pending" },
    });

    const owner = await tx.user.findFirst({
      where: { businessId: business.id, role: "owner" },
      select: { id: true },
    });
    if (owner) {
      await tx.notification.create({
        data: {
          userId: owner.id,
          type: "join_request",
          title: "Permintaan bergabung baru",
          body: me.email,
          href: "/dashboard/bisnis",
        },
      });
    }
  });

  revalidatePath("/dashboard/bisnis");
  return { ok: true };
}

/** Converts the signed-in non-active user into the owner of a brand-new business. */
export async function convertToOwnerBusiness({
  name,
  ownerName,
  ownerPhoneNumber,
}) {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: NO_SESSION };
  if (me.status === "active") return { ok: false, error: ALREADY_ACTIVE };

  const businessName = name?.toString().trim();
  const cleanOwnerName = ownerName?.toString().trim();
  const cleanPhone = ownerPhoneNumber?.toString().trim();
  if (!businessName || !cleanOwnerName || !cleanPhone) {
    return { ok: false, error: BUSINESS_FIELDS };
  }

  let updated = false;
  let lastError = null;

  for (let attempt = 0; attempt < MAX_INVITE_ATTEMPTS; attempt += 1) {
    const inviteCode = await generateUniqueInviteCode();
    try {
      await prisma.$transaction(async (tx) => {
        const business = await tx.business.create({
          data: {
            name: businessName,
            ownerName: cleanOwnerName,
            ownerPhoneNumber: cleanPhone,
            inviteCode,
          },
        });
        await tx.user.update({
          where: { id: me.id },
          data: { businessId: business.id, role: "owner", status: "active" },
        });
        await deleteStaleJoinRequests(tx, me.email, me.businessId);
      });
      updated = true;
      break;
    } catch (error) {
      lastError = error;
      if (error?.code === "P2002") continue;
      throw error;
    }
  }

  if (!updated) {
    console.error(
      "[auth] convertToOwnerBusiness failed after retries:",
      lastError,
    );
    return { ok: false, error: "Gagal membuat bisnis. Silakan coba lagi." };
  }

  revalidatePath("/dashboard/bisnis");
  return { ok: true };
}
