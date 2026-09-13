"use server";

import bcrypt from "bcryptjs";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateUniqueInviteCode } from "@/lib/invite-code";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NO_SESSION = "Sesi tidak ditemukan. Silakan masuk kembali.";
const NOT_OWNER = "Hanya pemilik bisnis yang dapat mengubah profil bisnis.";
const BUSINESS_FIELDS =
  "Nama bisnis, nama pemilik, dan nomor telepon wajib diisi.";
const MAX_INVITE_ATTEMPTS = 3;

function normalizeEmail(value) {
  return value?.toString().trim().toLowerCase() ?? "";
}

async function getCurrentUser() {
  const session = await auth();
  const userId = Number(session?.user?.id);
  if (!Number.isInteger(userId)) return null;
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      password: true,
      role: true,
      status: true,
      businessId: true,
    },
  });
}

/**
 * Updates the signed-in user's name/email. Changing the email requires the
 * current password and asks the UI to sign the user out (`reauthRequired`).
 */
export async function updateUserProfile({ name, email, currentPassword }) {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: NO_SESSION };

  const cleanName = name?.toString().trim();
  const cleanEmail = normalizeEmail(email);
  if (!cleanName || !cleanEmail) {
    return { ok: false, error: "Nama dan email wajib diisi." };
  }
  if (!EMAIL_RE.test(cleanEmail)) {
    return { ok: false, error: "Format email tidak valid." };
  }

  const emailChanged = cleanEmail !== me.email;

  if (emailChanged) {
    const taken = await prisma.user.findFirst({
      where: { email: cleanEmail, NOT: { id: me.id } },
      select: { id: true },
    });
    if (taken) {
      return { ok: false, error: "Email sudah terdaftar." };
    }

    const isValid = await bcrypt.compare(
      String(currentPassword ?? ""),
      me.password,
    );
    if (!isValid) {
      return { ok: false, error: "Password saat ini salah." };
    }
  }

  await prisma.user.update({
    where: { id: me.id },
    data: { name: cleanName, email: cleanEmail },
  });

  return { ok: true, reauthRequired: emailChanged };
}

/** Changes the signed-in user's password after verifying the current one. */
export async function changePassword({ currentPassword, newPassword }) {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: NO_SESSION };

  const isValid = await bcrypt.compare(
    String(currentPassword ?? ""),
    me.password,
  );
  if (!isValid) {
    return { ok: false, error: "Password saat ini salah." };
  }

  const nextPassword = newPassword?.toString() ?? "";
  if (nextPassword.length < 8) {
    return { ok: false, error: "Password baru minimal 8 karakter." };
  }

  const passwordHash = await bcrypt.hash(nextPassword, 12);
  await prisma.user.update({
    where: { id: me.id },
    data: { password: passwordHash },
  });

  return { ok: true };
}

/** Updates the actor's own business profile. Owner-only, checked from the DB. */
export async function updateBusinessProfile({
  name,
  ownerName,
  ownerPhoneNumber,
}) {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: NO_SESSION };
  if (me.role !== "owner") return { ok: false, error: NOT_OWNER };

  const businessName = name?.toString().trim();
  const cleanOwnerName = ownerName?.toString().trim();
  const cleanPhone = ownerPhoneNumber?.toString().trim();
  if (!businessName || !cleanOwnerName || !cleanPhone) {
    return { ok: false, error: BUSINESS_FIELDS };
  }

  await prisma.business.update({
    where: { id: me.businessId },
    data: {
      name: businessName,
      ownerName: cleanOwnerName,
      ownerPhoneNumber: cleanPhone,
    },
  });

  return { ok: true };
}

/** Regenerates the actor's own business invite code. Owner-only. */
export async function regenerateInviteCode() {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: NO_SESSION };
  if (me.role !== "owner") {
    return {
      ok: false,
      error: "Hanya pemilik bisnis yang dapat membuat ulang kode undangan.",
    };
  }

  let inviteCode = null;
  let lastError = null;

  for (let attempt = 0; attempt < MAX_INVITE_ATTEMPTS; attempt += 1) {
    const candidate = await generateUniqueInviteCode();
    try {
      await prisma.business.update({
        where: { id: me.businessId },
        data: { inviteCode: candidate },
      });
      inviteCode = candidate;
      break;
    } catch (error) {
      lastError = error;
      if (error?.code === "P2002") continue;
      throw error;
    }
  }

  if (!inviteCode) {
    console.error(
      "[profile] regenerateInviteCode failed after retries:",
      lastError,
    );
    return {
      ok: false,
      error: "Gagal membuat kode undangan baru. Silakan coba lagi.",
    };
  }

  return { ok: true, inviteCode };
}
