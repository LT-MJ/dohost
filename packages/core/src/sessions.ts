import { prisma } from "@hostpanel/db";
import { generateToken, hashToken } from "@hostpanel/shared/ids";
import { loadStaffActor, type StaffActor } from "./staff";
import { loadClientPortalActor, type ClientPortalActor } from "./clients";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const IMPERSONATION_TTL_MS = 30 * 60 * 1000;

export async function createStaffSession(input: {
  userId: string;
  tenantId: string;
  ip?: string;
  userAgent?: string;
}): Promise<string> {
  const token = generateToken(32);
  await prisma.staffSession.create({
    data: {
      tenantId: input.tenantId,
      userId: input.userId,
      tokenHash: hashToken(token),
      ip: input.ip,
      userAgent: input.userAgent,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });
  return token;
}

export async function validateStaffSession(token: string): Promise<StaffActor | null> {
  const session = await prisma.staffSession.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  await prisma.staffSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  return loadStaffActor(session.userId);
}

export async function revokeStaffSession(token: string, reason = "user_logout"): Promise<void> {
  await prisma.staffSession.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason },
  });
}

export async function createClientSession(input: {
  contactId: string;
  tenantId: string;
  ip?: string;
  userAgent?: string;
  impersonatedByStaffUserId?: string;
  impersonationReason?: string;
}): Promise<string> {
  const token = generateToken(32);
  const isImpersonation = Boolean(input.impersonatedByStaffUserId);
  await prisma.clientSession.create({
    data: {
      tenantId: input.tenantId,
      contactId: input.contactId,
      tokenHash: hashToken(token),
      ip: input.ip,
      userAgent: input.userAgent,
      expiresAt: new Date(Date.now() + (isImpersonation ? IMPERSONATION_TTL_MS : SESSION_TTL_MS)),
      impersonatedByStaffUserId: input.impersonatedByStaffUserId,
      impersonationReason: input.impersonationReason,
    },
  });
  return token;
}

export interface ClientSessionContext {
  actor: ClientPortalActor;
  impersonatedByStaffUserId: string | null;
}

export async function validateClientSession(token: string): Promise<ClientSessionContext | null> {
  const session = await prisma.clientSession.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  await prisma.clientSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  const actor = await loadClientPortalActor(session.contactId);
  if (!actor) return null;
  return { actor, impersonatedByStaffUserId: session.impersonatedByStaffUserId };
}

export async function revokeClientSession(token: string, reason = "user_logout"): Promise<void> {
  await prisma.clientSession.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason },
  });
}

export async function listStaffSessions(userId: string) {
  return prisma.staffSession.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" },
  });
}

export async function listClientSessions(contactId: string) {
  return prisma.clientSession.findMany({
    where: { contactId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" },
  });
}
