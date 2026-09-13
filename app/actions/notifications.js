"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const NO_SESSION = "Sesi tidak ditemukan. Silakan masuk kembali.";

function sessionUserId(session) {
  const userId = Number(session?.user?.id);
  return Number.isInteger(userId) ? userId : null;
}

/** Marks every unread notification of the session user as read. */
export async function markNotificationsRead() {
  const session = await auth();
  const userId = sessionUserId(session);
  if (userId === null) return { ok: false, error: NO_SESSION };

  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });

  return { ok: true };
}

/** Marks one notification as read, scoped to the session user (no IDOR). */
export async function markNotificationRead(id) {
  const session = await auth();
  const userId = sessionUserId(session);
  if (userId === null) return { ok: false, error: NO_SESSION };

  const notificationId = Number(id);
  if (!Number.isInteger(notificationId)) {
    return { ok: false, error: "Notifikasi tidak ditemukan." };
  }

  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { readAt: new Date() },
  });

  return { ok: true };
}
