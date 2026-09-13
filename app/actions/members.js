"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const NO_SESSION = "Sesi tidak ditemukan. Silakan masuk kembali.";
const NOT_OWNER = "Hanya pemilik bisnis yang dapat melakukan tindakan ini.";
const TARGET_NOT_FOUND = "Anggota tidak ditemukan.";
const NOT_PENDING = "Anggota ini tidak sedang menunggu persetujuan.";
const ACTOR_NOT_ACTIVE = "Akun Anda tidak aktif.";
const CANNOT_REMOVE_SELF = "Anda tidak dapat menghapus diri sendiri.";
const CANNOT_REMOVE_OWNER = "Pemilik bisnis tidak dapat dihapus.";
const TARGET_NOT_ACTIVE = "Hanya anggota aktif yang dapat dihapus.";

async function getActor() {
  const session = await auth();
  const actorId = Number(session?.user?.id);
  if (!Number.isInteger(actorId)) return null;
  return prisma.user.findUnique({
    where: { id: actorId },
    select: { id: true, role: true, status: true, businessId: true },
  });
}

function parseTargetId(userId) {
  const id = Number(userId);
  return Number.isInteger(id) ? id : null;
}

async function reviewMember(userId, decision) {
  const actor = await getActor();
  if (!actor) return { ok: false, error: NO_SESSION };
  if (actor.role !== "owner") return { ok: false, error: NOT_OWNER };

  const targetId = parseTargetId(userId);
  if (targetId === null) return { ok: false, error: TARGET_NOT_FOUND };

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, businessId: true, status: true },
  });
  // IDOR guard — an owner may only review members of their OWN business.
  if (!target || target.businessId !== actor.businessId) {
    return { ok: false, error: TARGET_NOT_FOUND };
  }
  if (target.status !== "pending") {
    return { ok: false, error: NOT_PENDING };
  }

  const approved = decision === "approve";
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: target.id },
      data: { status: approved ? "active" : "rejected" },
    });
    await tx.notification.create({
      data: {
        userId: target.id,
        type: approved ? "join_approved" : "join_rejected",
        title: approved ? "Pendaftaran disetujui" : "Pendaftaran ditolak",
        body: approved
          ? "Permintaan bergabung Anda telah disetujui. Anda kini dapat mengakses dasbor."
          : "Permintaan bergabung Anda ditolak oleh pemilik bisnis.",
        href: "/menunggu-persetujuan",
      },
    });
  });

  revalidatePath("/dashboard/bisnis");
  return { ok: true };
}

/** Approves a pending member of the actor's business. */
export async function approveMember(userId) {
  return reviewMember(userId, "approve");
}

/** Rejects a pending member of the actor's business. */
export async function rejectMember(userId) {
  return reviewMember(userId, "reject");
}

/**
 * Removes an ACTIVE, non-owner member from the actor's business. The member's
 * account is kept; they are detached from the business (status "removed") and
 * notified. All checks are DB-authoritative and run before any mutation.
 */
export async function removeMember(userId) {
  const actor = await getActor();
  if (!actor) return { ok: false, error: NO_SESSION };
  if (actor.status !== "active") return { ok: false, error: ACTOR_NOT_ACTIVE };
  if (actor.role !== "owner") return { ok: false, error: NOT_OWNER };

  const targetId = parseTargetId(userId);
  if (targetId === null) return { ok: false, error: TARGET_NOT_FOUND };

  // An owner cannot remove themselves (and must never orphan the business).
  if (targetId === actor.id) return { ok: false, error: CANNOT_REMOVE_SELF };

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: {
      id: true,
      businessId: true,
      role: true,
      status: true,
      business: { select: { name: true } },
    },
  });
  // IDOR guard — an owner may only remove members of their OWN business.
  if (!target || target.businessId !== actor.businessId) {
    return { ok: false, error: TARGET_NOT_FOUND };
  }
  if (target.role === "owner") {
    return { ok: false, error: CANNOT_REMOVE_OWNER };
  }
  if (target.status !== "active") {
    return { ok: false, error: TARGET_NOT_ACTIVE };
  }

  const businessName = target.business.name;
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: target.id },
      data: { status: "removed" },
    });
    await tx.notification.create({
      data: {
        userId: target.id,
        type: "member_removed",
        title: "Akses dihapus",
        body: `Akses Anda telah dihapus dari bisnis ${businessName}.`,
        href: null,
      },
    });
  });

  revalidatePath("/dashboard/bisnis");
  return { ok: true };
}

/** Returns the DB membership status for the signed-in user (for the poller). */
export async function getMyMembershipStatus() {
  const session = await auth();
  const userId = Number(session?.user?.id);
  if (!Number.isInteger(userId)) return { status: null };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true },
  });
  return { status: user?.status ?? null };
}
