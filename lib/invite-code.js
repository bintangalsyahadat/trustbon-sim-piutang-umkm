import { randomInt } from "node:crypto";

import { prisma } from "@/lib/prisma";

// No ambiguous characters (I, O, 0, 1) to keep codes easy to read/share.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 5;
const MAX_ATTEMPTS = 8;

function randomCode() {
  let suffix = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    suffix += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return `TB-${suffix}`;
}

/**
 * Generates a random, collision-free business invite code (`TB-XXXXX`).
 * Retries up to MAX_ATTEMPTS times against the unique constraint.
 */
export async function generateUniqueInviteCode() {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const inviteCode = randomCode();
    const existing = await prisma.business.findUnique({
      where: { inviteCode },
      select: { id: true },
    });
    if (!existing) return inviteCode;
  }
  throw new Error(
    `Gagal menghasilkan kode undangan unik setelah ${MAX_ATTEMPTS} percobaan.`,
  );
}
