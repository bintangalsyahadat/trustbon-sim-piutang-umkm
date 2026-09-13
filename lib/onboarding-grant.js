import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_TTL_MS = 120000;

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set");
  }
  return secret;
}

/**
 * Mints a short-lived onboarding grant:
 *   base64url(`${email}.${expMs}`) + "." + base64url(HMAC-SHA256(payload))
 * The HMAC is computed over the raw `${email}.${expMs}` payload.
 */
export function mintOnboardingGrant(email, ttlMs = DEFAULT_TTL_MS) {
  const expMs = Date.now() + ttlMs;
  const payload = `${email}.${expMs}`;
  const encoded = Buffer.from(payload, "utf8").toString("base64url");
  const signature = createHmac("sha256", getSecret())
    .update(payload)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

/**
 * Verifies an onboarding grant. Returns { email } when valid and unexpired,
 * otherwise null. Uses constant-time signature comparison.
 */
export function verifyOnboardingGrant(token) {
  if (typeof token !== "string" || token.length === 0) return null;
  try {
    const separator = token.lastIndexOf(".");
    if (separator <= 0 || separator === token.length - 1) return null;

    const encoded = token.slice(0, separator);
    const providedSig = token.slice(separator + 1);

    const payload = Buffer.from(encoded, "base64url").toString("utf8");
    const expectedSig = createHmac("sha256", getSecret())
      .update(payload)
      .digest("base64url");

    const providedBuf = Buffer.from(providedSig, "base64url");
    const expectedBuf = Buffer.from(expectedSig, "base64url");
    if (providedBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(providedBuf, expectedBuf)) return null;

    const expSeparator = payload.lastIndexOf(".");
    if (expSeparator <= 0) return null;

    const email = payload.slice(0, expSeparator);
    const expMs = Number(payload.slice(expSeparator + 1));
    if (!email || !Number.isFinite(expMs)) return null;
    if (Date.now() > expMs) return null;

    return { email };
  } catch {
    return null;
  }
}
