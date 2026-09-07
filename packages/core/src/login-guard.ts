import { prisma } from "@hostpanel/db";
import type { AuthActorType } from "@hostpanel/db";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MINUTES = 15;
const LOCKOUT_DURATION_MINUTES = 15;

export async function recordLoginAttempt(input: {
  tenantId: string;
  actorType: AuthActorType;
  actorId: string | null;
  email: string;
  success: boolean;
  reason?: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  await prisma.loginEvent.create({
    data: {
      tenantId: input.tenantId,
      actorType: input.actorType,
      actorId: input.actorId,
      email: input.email.toLowerCase(),
      success: input.success,
      reason: input.reason,
      ip: input.ip,
      userAgent: input.userAgent,
    },
  });
}

/** Brute-force guard: too many recent failures for this email locks it out. */
export async function shouldLockOut(input: {
  tenantId: string;
  actorType: AuthActorType;
  email: string;
}): Promise<boolean> {
  const since = new Date(Date.now() - LOCKOUT_WINDOW_MINUTES * 60_000);
  const recentFailures = await prisma.loginEvent.count({
    where: {
      tenantId: input.tenantId,
      actorType: input.actorType,
      email: input.email.toLowerCase(),
      success: false,
      createdAt: { gte: since },
    },
  });
  return recentFailures >= MAX_FAILED_ATTEMPTS;
}

export function computeLockoutExpiry(): Date {
  return new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60_000);
}
