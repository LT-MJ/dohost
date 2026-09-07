import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

/**
 * High-entropy opaque token generation/hashing for session tokens, email
 * verification links, password reset links, and 2FA recovery codes. Tokens
 * are always stored hashed (sha256 is appropriate here — these are random,
 * high-entropy secrets, not low-entropy user passwords, so Argon2id's
 * deliberate slowness is unnecessary and would only add load).
 */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function verifyTokenHash(token: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/** Human-friendly recovery codes, e.g. "7K3F-9XQ2-VB4M". Stored hashed, shown once. */
export function generateRecoveryCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const randomChar = (): string => {
    const index = randomBytes(1)[0]! % alphabet.length;
    return alphabet[index]!;
  };
  const groups = Array.from({ length: 3 }, () =>
    Array.from({ length: 4 }, randomChar).join(""),
  );
  return groups.join("-");
}
