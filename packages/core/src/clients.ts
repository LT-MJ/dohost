import { hashPassword, verifyPassword } from "@hostpanel/auth/password";
import { prisma, recordAuditLog, recordStatusTransition } from "@hostpanel/db";
import type { ClientStatus } from "@hostpanel/db";
import { AUDIT_ACTIONS } from "@hostpanel/shared/audit";
import { getEnv } from "@hostpanel/shared/config";
import { AuthenticationError, BusinessRuleError } from "@hostpanel/shared/errors";
import { generateToken, hashToken } from "@hostpanel/shared/ids";
import { DEFAULT_PRIMARY_CONTACT_PERMISSIONS, PERMISSIONS } from "@hostpanel/shared/permissions";
import { requirePermission, type PermissionActor } from "@hostpanel/auth/rbac";
import { queueEmail } from "@hostpanel/jobs";
import { computeLockoutExpiry, recordLoginAttempt, shouldLockOut } from "./login-guard";
import type { StaffActor } from "./staff";

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export interface ClientPortalActor extends PermissionActor {
  type: "CLIENT_CONTACT";
  id: string;
  clientId: string;
  tenantId: string;
  label: string;
}

const CLIENT_TRANSITIONS: Record<ClientStatus, ClientStatus[]> = {
  PENDING_VERIFICATION: ["ACTIVE", "CLOSED"],
  ACTIVE: ["SUSPENDED", "CLOSED"],
  SUSPENDED: ["ACTIVE", "CLOSED"],
  CLOSED: [],
};

async function transitionClientStatus(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  clientId: string,
  toStatus: ClientStatus,
  actor: { type: "STAFF" | "CLIENT_CONTACT" | "SYSTEM"; id: string | null },
  reason?: string,
) {
  const client = await tx.client.findUniqueOrThrow({ where: { id: clientId } });
  const allowed = CLIENT_TRANSITIONS[client.status] ?? [];
  if (!allowed.includes(toStatus)) {
    throw new BusinessRuleError({
      code: "client.invalid_transition",
      message: `Cannot move a client from ${client.status} to ${toStatus}.`,
    });
  }
  const updated = await tx.client.update({ where: { id: clientId }, data: { status: toStatus } });
  await recordStatusTransition(tx, {
    tenantId: client.tenantId,
    entityType: "CLIENT",
    entityId: clientId,
    fromStatus: client.status,
    toStatus,
    actorType: actor.type,
    actorId: actor.id,
    reason,
  });
  return updated;
}

export async function registerClient(input: {
  tenantId: string;
  type: "INDIVIDUAL" | "COMPANY";
  companyName?: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  country?: string;
  currency?: string;
  ip?: string;
}): Promise<{ clientId: string; contactId: string }> {
  const email = input.email.toLowerCase().trim();

  const [existingClient, existingContact] = await Promise.all([
    prisma.client.findUnique({ where: { tenantId_email: { tenantId: input.tenantId, email } } }),
    prisma.clientContact.findUnique({
      where: { tenantId_email: { tenantId: input.tenantId, email } },
    }),
  ]);
  if (existingClient || existingContact) {
    throw new BusinessRuleError({
      code: "client.email_taken",
      message: "An account with this email already exists.",
    });
  }

  const passwordHash = await hashPassword(input.password);

  const { clientId, contactId } = await prisma.$transaction(async (tx) => {
    const client = await tx.client.create({
      data: {
        tenantId: input.tenantId,
        type: input.type,
        companyName: input.companyName,
        firstName: input.firstName,
        lastName: input.lastName,
        email,
        country: input.country,
        currency: input.currency ?? "USD",
        status: "PENDING_VERIFICATION",
      },
    });
    const contact = await tx.clientContact.create({
      data: {
        tenantId: input.tenantId,
        clientId: client.id,
        email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        isPrimary: true,
        permBilling: DEFAULT_PRIMARY_CONTACT_PERMISSIONS.billing,
        permSupport: DEFAULT_PRIMARY_CONTACT_PERMISSIONS.support,
        permDomains: DEFAULT_PRIMARY_CONTACT_PERMISSIONS.domains,
        permServices: DEFAULT_PRIMARY_CONTACT_PERMISSIONS.services,
      },
    });
    await recordStatusTransition(tx, {
      tenantId: input.tenantId,
      entityType: "CLIENT",
      entityId: client.id,
      fromStatus: null,
      toStatus: "PENDING_VERIFICATION",
      actorType: "CLIENT_CONTACT",
      actorId: contact.id,
      reason: "self_registration",
    });
    await recordAuditLog(tx, {
      tenantId: input.tenantId,
      actorType: "CLIENT_CONTACT",
      actorId: contact.id,
      actorLabel: `${input.firstName} ${input.lastName} <${email}>`,
      action: AUDIT_ACTIONS.CLIENT_CREATED,
      entityType: "CLIENT",
      entityId: client.id,
      ip: input.ip,
      afterState: { email, type: input.type },
    });
    return { clientId: client.id, contactId: contact.id };
  });

  const token = generateToken(32);
  await prisma.emailVerificationToken.create({
    data: {
      tenantId: input.tenantId,
      actorType: "CLIENT_CONTACT",
      actorId: contactId,
      email,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
    },
  });

  const env = getEnv();
  await queueEmail(input.tenantId, {
    to: email,
    subject: `Verify your email for ${env.APP_NAME}`,
    template: "verify_email",
    props: {
      appName: env.APP_NAME,
      recipientName: input.firstName,
      verifyUrl: `${env.APP_URL}/verify-email?token=${token}`,
    },
    relatedEntityType: "CLIENT_CONTACT",
    relatedEntityId: contactId,
  });

  return { clientId, contactId };
}

export async function verifyClientEmail(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  const record = await prisma.emailVerificationToken.findUnique({ where: { tokenHash } });
  if (
    !record ||
    record.actorType !== "CLIENT_CONTACT" ||
    record.consumedAt ||
    record.expiresAt < new Date()
  ) {
    throw new AuthenticationError({
      code: "auth.invalid_token",
      message: "This verification link is invalid or has expired.",
    });
  }

  const contact = await prisma.clientContact.findUniqueOrThrow({ where: { id: record.actorId } });

  await prisma.$transaction(async (tx) => {
    await tx.clientContact.update({
      where: { id: contact.id },
      data: { emailVerifiedAt: new Date() },
    });
    await tx.emailVerificationToken.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });
    const client = await tx.client.findUniqueOrThrow({ where: { id: contact.clientId } });
    if (client.status === "PENDING_VERIFICATION") {
      await transitionClientStatus(tx, client.id, "ACTIVE", { type: "CLIENT_CONTACT", id: contact.id }, "email_verified");
      await tx.client.update({ where: { id: client.id }, data: { verificationStatus: "VERIFIED" } });
    }
  });

  const env = getEnv();
  await queueEmail(contact.tenantId, {
    to: contact.email,
    subject: `Welcome to ${env.APP_NAME}`,
    template: "welcome",
    props: {
      appName: env.APP_NAME,
      recipientName: contact.firstName,
      loginUrl: `${env.APP_URL}/login`,
    },
    relatedEntityType: "CLIENT_CONTACT",
    relatedEntityId: contact.id,
  });
}

export async function requestClientPasswordReset(tenantId: string, email: string): Promise<void> {
  const normalized = email.toLowerCase().trim();
  const contact = await prisma.clientContact.findUnique({
    where: { tenantId_email: { tenantId, email: normalized } },
  });
  if (!contact || contact.status !== "ACTIVE" || contact.deletedAt) return;

  const token = generateToken(32);
  await prisma.passwordResetToken.create({
    data: {
      tenantId,
      actorType: "CLIENT_CONTACT",
      actorId: contact.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
    },
  });
  const env = getEnv();
  await queueEmail(tenantId, {
    to: normalized,
    subject: `Reset your ${env.APP_NAME} password`,
    template: "reset_password",
    props: {
      appName: env.APP_NAME,
      recipientName: contact.firstName,
      resetUrl: `${env.APP_URL}/reset-password?token=${token}`,
    },
    relatedEntityType: "CLIENT_CONTACT",
    relatedEntityId: contact.id,
  });
}

export async function setClientPassword(token: string, newPassword: string): Promise<void> {
  const tokenHash = hashToken(token);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (
    !record ||
    record.actorType !== "CLIENT_CONTACT" ||
    record.consumedAt ||
    record.expiresAt < new Date()
  ) {
    throw new AuthenticationError({
      code: "auth.invalid_token",
      message: "This link is invalid or has expired.",
    });
  }
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.clientContact.update({ where: { id: record.actorId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { consumedAt: new Date() } }),
  ]);
}

export interface AuthenticatedClientContact {
  id: string;
  clientId: string;
  tenantId: string;
  email: string;
  firstName: string;
}

export async function authenticateClientContact(input: {
  tenantId: string;
  email: string;
  password: string;
  ip?: string;
  userAgent?: string;
}): Promise<AuthenticatedClientContact> {
  const email = input.email.toLowerCase().trim();
  const contact = await prisma.clientContact.findUnique({
    where: { tenantId_email: { tenantId: input.tenantId, email } },
    include: { client: true },
  });

  const fail = async (reason: string): Promise<never> => {
    await recordLoginAttempt({
      tenantId: input.tenantId,
      actorType: "CLIENT_CONTACT",
      actorId: contact?.id ?? null,
      email,
      success: false,
      reason,
      ip: input.ip,
      userAgent: input.userAgent,
    });
    throw new AuthenticationError({
      code: "auth.invalid_credentials",
      message: "Incorrect email or password.",
    });
  };

  if (!contact || contact.status !== "ACTIVE" || contact.deletedAt) return fail("not_found_or_disabled");
  if (contact.client.status === "SUSPENDED" || contact.client.status === "CLOSED") {
    return fail("account_" + contact.client.status.toLowerCase());
  }
  if (contact.lockedUntil && contact.lockedUntil > new Date()) return fail("locked");

  const passwordOk = await verifyPassword(contact.passwordHash, input.password);
  if (!passwordOk) {
    if (await shouldLockOut({ tenantId: input.tenantId, actorType: "CLIENT_CONTACT", email })) {
      await prisma.clientContact.update({
        where: { id: contact.id },
        data: { lockedUntil: computeLockoutExpiry() },
      });
    }
    return fail("bad_password");
  }

  await recordLoginAttempt({
    tenantId: input.tenantId,
    actorType: "CLIENT_CONTACT",
    actorId: contact.id,
    email,
    success: true,
    ip: input.ip,
    userAgent: input.userAgent,
  });
  await prisma.$transaction([
    prisma.clientContact.update({
      where: { id: contact.id },
      data: { lastLoginAt: new Date(), lastLoginIp: input.ip, lockedUntil: null },
    }),
    prisma.client.update({ where: { id: contact.clientId }, data: { lastLoginAt: new Date() } }),
  ]);

  return {
    id: contact.id,
    clientId: contact.clientId,
    tenantId: input.tenantId,
    email: contact.email,
    firstName: contact.firstName,
  };
}

export async function loadClientPortalActor(contactId: string): Promise<ClientPortalActor | null> {
  const contact = await prisma.clientContact.findUnique({ where: { id: contactId } });
  if (!contact || contact.status !== "ACTIVE" || contact.deletedAt) return null;
  const permissions: PermissionActor["permissions"] = [];
  return {
    type: "CLIENT_CONTACT",
    id: contact.id,
    clientId: contact.clientId,
    tenantId: contact.tenantId,
    label: `${contact.firstName} ${contact.lastName} <${contact.email}>`,
    permissions,
  };
}

export async function addClientNote(
  actor: StaffActor,
  clientId: string,
  body: string,
): Promise<void> {
  requirePermission(actor, PERMISSIONS.CLIENTS_WRITE);
  await prisma.clientNote.create({
    data: { tenantId: actor.tenantId, clientId, body, authorStaffUserId: actor.id, authorLabel: actor.label },
  });
}

export async function changeClientStatus(
  actor: StaffActor,
  clientId: string,
  toStatus: ClientStatus,
  reason: string,
): Promise<void> {
  requirePermission(actor, PERMISSIONS.CLIENTS_WRITE);
  await prisma.$transaction(async (tx) => {
    const updated = await transitionClientStatus(tx, clientId, toStatus, { type: "STAFF", id: actor.id }, reason);
    await recordAuditLog(tx, {
      tenantId: actor.tenantId,
      actorType: "STAFF",
      actorId: actor.id,
      actorLabel: actor.label,
      action: AUDIT_ACTIONS.CLIENT_STATUS_CHANGED,
      entityType: "CLIENT",
      entityId: clientId,
      reason,
      afterState: { status: updated.status },
    });
  });
}

export async function updateClientProfile(
  actor: ClientPortalActor | StaffActor,
  clientId: string,
  patch: {
    firstName?: string;
    lastName?: string;
    companyName?: string;
    phone?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    language?: string;
    timezone?: string;
  },
): Promise<void> {
  if (actor.type === "CLIENT_CONTACT" && actor.clientId !== clientId) {
    throw new BusinessRuleError({
      code: "client.forbidden",
      message: "You can only manage your own account.",
    });
  }
  if (actor.type === "STAFF") {
    requirePermission(actor, PERMISSIONS.CLIENTS_WRITE);
  }

  await prisma.$transaction(async (tx) => {
    const before = await tx.client.findUniqueOrThrow({ where: { id: clientId } });
    const after = await tx.client.update({ where: { id: clientId }, data: patch });
    await recordAuditLog(tx, {
      tenantId: after.tenantId,
      actorType: actor.type,
      actorId: actor.id,
      actorLabel: actor.label,
      action: AUDIT_ACTIONS.CLIENT_UPDATED,
      entityType: "CLIENT",
      entityId: clientId,
      beforeState: patch as Record<string, unknown>,
      afterState: Object.fromEntries(
        Object.keys(patch).map((key) => [key, (after as unknown as Record<string, unknown>)[key]]),
      ),
      metadata: { previousValues: Object.fromEntries(Object.keys(patch).map((key) => [key, (before as unknown as Record<string, unknown>)[key]])) },
    });
  });
}
