import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { getEnv } from "@hostpanel/shared/config";

/**
 * AES-256-GCM at-rest encryption for sensitive fields that must be
 * recoverable (TOTP secrets, and later registrar EPP codes / provisioning
 * credentials) — as opposed to passwords, which are one-way hashed and
 * never need decrypting. Never store these fields in plaintext.
 */
const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const env = getEnv();
  const key = Buffer.from(env.ENCRYPTION_KEY, "base64");
  if (key.length !== 32) {
    throw new Error(
      "ENCRYPTION_KEY must be a base64 string decoding to exactly 32 bytes (openssl rand -base64 32)",
    );
  }
  return key;
}

/** Returns "iv.authTag.ciphertext", each base64-encoded. */
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, encrypted].map((buf) => buf.toString("base64")).join(".");
}

export function decryptSecret(ciphertext: string): string {
  const parts = ciphertext.split(".");
  const [ivB64, tagB64, dataB64] = parts;
  if (parts.length !== 3 || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Malformed ciphertext: expected \"iv.authTag.data\"");
  }
  const key = getKey();
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}
