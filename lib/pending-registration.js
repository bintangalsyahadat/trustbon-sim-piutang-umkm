import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

export const PENDING_COOKIE = "tb_pending_reg";

const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set");
  }
  return createHash("sha256").update(secret).digest();
}

/**
 * Encrypts a pending-registration payload into an opaque, URL-safe token.
 * Layout (before base64url): iv (12 bytes) | tag (16 bytes) | ciphertext
 */
export function sealPendingRegistration(payload) {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64url");
}

/**
 * Decrypts a token produced by sealPendingRegistration.
 * Returns the parsed payload on success, or null on any failure.
 */
export function openPendingRegistration(token) {
  if (typeof token !== "string" || token.length === 0) return null;
  try {
    const key = getKey();
    const raw = Buffer.from(token, "base64url");
    if (raw.length <= IV_LENGTH + TAG_LENGTH) return null;
    const iv = raw.subarray(0, IV_LENGTH);
    const tag = raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = raw.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return JSON.parse(plaintext.toString("utf8"));
  } catch {
    return null;
  }
}
