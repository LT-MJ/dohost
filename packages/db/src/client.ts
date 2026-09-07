import { PrismaPg } from "@prisma/adapter-pg";
import { getEnv } from "@hostpanel/shared/config";
import { PrismaClient } from "../generated/prisma/client";

declare global {
  var __hostpanelPrisma: PrismaClient | undefined;
}

function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: getEnv().DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

function getOrCreateClient(): PrismaClient {
  globalThis.__hostpanelPrisma ??= createClient();
  return globalThis.__hostpanelPrisma;
}

/**
 * Singleton PrismaClient, constructed lazily on first use rather than at
 * module load time. Standalone entrypoints (the worker, the seed script)
 * load environment variables themselves as their first step — if this
 * module read `getEnv()` eagerly at import time, merely importing
 * `@hostpanel/db` before that env-loading step ran would crash, since ESM
 * evaluates a module's imports (and their own side effects) before its own
 * top-level code runs. A Proxy defers the real client construction (and
 * thus the env read) until the first actual property access.
 *
 * Next.js dev mode hot-reloads modules, which would otherwise create a new
 * PrismaClient (and a new connection pool) on every edit — stashing the
 * real client on `global` (see getOrCreateClient) lets it survive reloads.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getOrCreateClient(), prop, receiver);
  },
});
