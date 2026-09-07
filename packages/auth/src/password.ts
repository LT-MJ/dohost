import { hash, verify } from "@node-rs/argon2";

/**
 * OWASP-baseline Argon2id parameters for a server-side auth path (not a
 * constrained client device) — see SECURITY.md for the rationale. Never
 * lower these to "make login feel faster"; if hashing is a bottleneck,
 * scale the auth service, not the cost parameters.
 *
 * `algorithm: 2` is `Algorithm.Argon2id` from @node-rs/argon2 — that enum is
 * declared `const enum`, which `isolatedModules` (required for our build
 * pipeline) forbids importing, so the value is inlined here instead.
 */
const HASH_OPTIONS = {
  algorithm: 2,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(plainPassword: string): Promise<string> {
  return hash(plainPassword, HASH_OPTIONS);
}

export async function verifyPassword(storedHash: string, plainPassword: string): Promise<boolean> {
  return verify(storedHash, plainPassword);
}
