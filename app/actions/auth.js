"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { signOut } from "@/auth";
import {
  PENDING_COOKIE,
  openPendingRegistration,
  sealPendingRegistration,
} from "@/lib/pending-registration";
import { mintOnboardingGrant } from "@/lib/onboarding-grant";
import { generateUniqueInviteCode } from "@/lib/invite-code";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_INVITE_ATTEMPTS = 3;

const PENDING_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: 1800,
  secure: process.env.NODE_ENV === "production",
};

function normalizeEmail(value) {
  return value?.toString().trim().toLowerCase() ?? "";
}

export async function registerPending(prevState, formData) {
  const name = formData.get("name")?.toString().trim();
  const email = normalizeEmail(formData.get("email"));
  const password = formData.get("password")?.toString() ?? "";

  if (!name || !email || !password) {
    return { error: "Nama, email, dan password wajib diisi." };
  }
  if (!EMAIL_RE.test(email)) {
    return { error: "Format email tidak valid." };
  }
  if (password.length < 8) {
    return { error: "Password minimal 8 karakter." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "Email sudah terdaftar." };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const sealed = sealPendingRegistration({ name, email, passwordHash });

  const cookieStore = await cookies();
  cookieStore.set(PENDING_COOKIE, sealed, PENDING_COOKIE_OPTIONS);

  redirect("/register/choice");
}

export async function completeBusinessOnboarding({
  name,
  ownerName,
  ownerPhoneNumber,
}) {
  const cookieStore = await cookies();
  const sealed = cookieStore.get(PENDING_COOKIE)?.value;
  const pending = sealed ? openPendingRegistration(sealed) : null;
  if (!pending) {
    return {
      error: "Sesi pendaftaran tidak ditemukan. Silakan daftar ulang.",
    };
  }

  const businessName = name?.toString().trim();
  const cleanOwnerName = ownerName?.toString().trim();
  const cleanPhone = ownerPhoneNumber?.toString().trim();
  if (!businessName || !cleanOwnerName || !cleanPhone) {
    return { error: "Nama bisnis, nama pemilik, dan nomor telepon wajib diisi." };
  }

  const email = normalizeEmail(pending.email);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "Email sudah terdaftar." };
  }

  let createdUser = null;
  let lastError = null;

  for (let attempt = 0; attempt < MAX_INVITE_ATTEMPTS; attempt += 1) {
    const inviteCode = await generateUniqueInviteCode();
    try {
      createdUser = await prisma.$transaction(async (tx) => {
        const business = await tx.business.create({
          data: {
            name: businessName,
            ownerName: cleanOwnerName,
            ownerPhoneNumber: cleanPhone,
            inviteCode,
          },
        });
        return tx.user.create({
          data: {
            businessId: business.id,
            name: pending.name,
            email,
            password: pending.passwordHash,
            role: "owner",
            status: "active",
          },
        });
      });
      break;
    } catch (error) {
      lastError = error;
      if (error?.code === "P2002") continue;
      throw error;
    }
  }

  if (!createdUser) {
    console.error(
      "[auth] completeBusinessOnboarding failed after retries:",
      lastError,
    );
    return { error: "Gagal membuat bisnis. Silakan coba lagi." };
  }

  cookieStore.delete(PENDING_COOKIE);

  return {
    ok: true,
    email,
    grant: mintOnboardingGrant(email),
  };
}

export async function completeJoinOnboarding({ inviteCode }) {
  const cookieStore = await cookies();
  const sealed = cookieStore.get(PENDING_COOKIE)?.value;
  const pending = sealed ? openPendingRegistration(sealed) : null;
  if (!pending) {
    return {
      error: "Sesi pendaftaran tidak ditemukan. Silakan daftar ulang.",
    };
  }

  const code = inviteCode?.toString().trim().toUpperCase();
  if (!code) {
    return { error: "Kode undangan wajib diisi." };
  }

  const business = await prisma.business.findUnique({
    where: { inviteCode: code },
  });
  if (!business) {
    return { error: "Kode undangan tidak valid." };
  }

  const email = normalizeEmail(pending.email);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "Email sudah terdaftar." };
  }

  // Joiners are NOT active members: they start as `pending` until the business
  // owner approves them from /dashboard/bisnis.
  await prisma.$transaction(async (tx) => {
    await tx.user.create({
      data: {
        businessId: business.id,
        name: pending.name,
        email,
        password: pending.passwordHash,
        role: "cashier",
        status: "pending",
      },
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
          body: email,
          href: "/dashboard/bisnis",
        },
      });
    }
  });

  cookieStore.delete(PENDING_COOKIE);

  return {
    ok: true,
    email,
    grant: mintOnboardingGrant(email),
  };
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}
