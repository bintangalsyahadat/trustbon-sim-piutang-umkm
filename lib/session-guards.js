import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Server-only session guards. Plain module (NOT "use server"): it is imported by
 * server components and layouts, not exposed as a server action.
 *
 * These are the DB-authoritative authorization checks. The proxy only performs
 * optimistic cookie checks and must never be relied upon for access control.
 */

const MEMBER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  businessId: true,
};

function sessionUserId(session) {
  const userId = Number(session?.user?.id);
  return Number.isInteger(userId) ? userId : null;
}

/** Requires a signed-in session; otherwise redirects to /login. */
export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return { session };
}

/**
 * Requires a signed-in user whose DB row exists and has status "active".
 * This is the authoritative dashboard gate.
 */
export async function requireActiveMember() {
  const session = await auth();
  const userId = sessionUserId(session);
  if (userId === null) {
    redirect("/login");
  }

  const member = await prisma.user.findUnique({
    where: { id: userId },
    select: MEMBER_SELECT,
  });
  if (!member) {
    redirect("/login");
  }
  // Removed members are detached from their business and must re-onboard.
  if (member.status === "removed") {
    redirect("/register/choice");
  }
  if (member.status !== "active") {
    redirect("/menunggu-persetujuan");
  }

  return { session, member };
}

/** Requires an active member with role "owner"; otherwise redirects to /dashboard. */
export async function requireOwner() {
  const { session, member } = await requireActiveMember();
  if (member.role !== "owner") {
    redirect("/dashboard");
  }
  return { session, member };
}
