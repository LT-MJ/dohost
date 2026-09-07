import { decryptSecret, encryptSecret } from "@hostpanel/auth/crypto";
import { hashPassword, verifyPassword } from "@hostpanel/auth/password";
import { requirePermission, type PermissionActor } from "@hostpanel/auth/rbac";
import { generateTotpSecret, totpProvisioningUri, totpQrCodeDataUrl, verifyTotpToken } from "@hostpanel/auth/totp";
import { prisma, recordAuditLog } from "@hostpanel/db";
import { AUDIT_ACTIONS } from "@hostpanel/shared/audit";
import { getEnv } from "@hostpanel/shared/config";
import { AuthenticationError, BusinessRuleError, ValidationError } from "@hostpanel/shared/errors";
import { generateRecoveryCode, generateToken, hashToken } from "@hostpanel/shared/ids";
import {
  PERMISSIONS,
  type PermissionKey,
  STAFF_ROLE_LABELS,
  type StaffRoleKey,
} from "@hostpanel/shared/permissions";
import { queueEmail } from "@hostpanel/jobs";
import { computeLockoutExpiry, recordLoginAttempt, shouldLockOut } from "./login-guard";

const PASSWORD_SET_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export interface StaffActor extends PermissionActor {
  type: "STAFF";
  id: string;
  tenantId: string;
  label: string;
}

export interface AuthenticatedStaff {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  mustChangePassword: boolean;
}

/** Loads the current permission set for a staff user straight from the
 * database (never trusted from a stale JWT claim) — called on every
 * request that needs an authorization decision. */
export async function loadStaffActor(userId: string): Promise<StaffActor | null> {
  const user = await prisma.staffUser.findUnique({
    where: { id: userId },
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  });
  if (!user || user.status !== "ACTIVE" || user.deletedAt) return null;
  return {
    type: "STAFF",
    id: user.id,
    tenantId: user.tenantId,
    label: `${user.name} <${user.email}>`,
    permissions: user.role.permissions.map((rp) => rp.permission.key as PermissionKey),
  };
}

export async function createStaffUser(
  actor: StaffActor,
  input: { email: string; name: string; roleKey: StaffRoleKey; ip?: string },
): Promise<{ id: string; email: string; name: string }> {
  requirePermission(actor, PERMISSIONS.STAFF_MANAGE);

  const role = await prisma.role.findUnique({
    where: { tenantId_key: { tenantId: actor.tenantId, key: input.roleKey } },
  });
  if (!role) {
    throw new ValidationError({ code: "staff.invalid_role", message: "Unknown role." });
  }

  const email = input.email.toLowerCase().trim();
  const existing = await prisma.staffUser.findUnique({
    where: { tenantId_email: { tenantId: actor.tenantId, email } },
  });
  if (existing) {
    throw new BusinessRuleError({
      code: "staff.email_taken",
      message: "A staff account with this email already exists.",
    });
  }

  // Unusable placeholder — overwritten once the invite link is used.
  // NOT NULL requires *some* value; no plaintext produces this hash.
  const placeholderHash = await hashPassword(generateToken(32));

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.staffUser.create({
      data: {
        tenantId: actor.tenantId,
        email,
        name: input.name,
        roleId: role.id,
        passwordHash: placeholderHash,
        mustChangePassword: true,
      },
    });
    await recordAuditLog(tx, {
      tenantId: actor.tenantId,
      actorType: "STAFF",
      actorId: actor.id,
      actorLabel: actor.label,
      action: AUDIT_ACTIONS.STAFF_USER_CREATED,
      entityType: "STAFF_USER",
      entityId: created.id,
      ip: input.ip,
      afterState: { email, name: input.name, roleKey: input.roleKey },
    });
    return created;
  });

  const token = generateToken(32);
  await prisma.passwordResetToken.create({
    data: {
      tenantId: actor.tenantId,
      actorType: "STAFF",
      actorId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + PASSWORD_SET_TOKEN_TTL_MS),
    },
  });

  const env = getEnv();
  await queueEmail(actor.tenantId, {
    to: email,
    subject: `You've been added to ${env.APP_NAME}`,
    template: "staff_invite",
    props: {
      appName: env.APP_NAME,
      recipientName: input.name,
      roleName: STAFF_ROLE_LABELS[input.roleKey],
      setPasswordUrl: `${env.APP_URL}/admin/set-password?token=${token}`,
    },
    relatedEntityType: "STAFF_USER",
    relatedEntityId: user.id,
  });

  return { id: user.id, email, name: input.name };
}

export async function disableStaffUser(actor: StaffActor, targetUserId: string): Promise<void> {
  requirePermission(actor, PERMISSIONS.STAFF_MANAGE);
  await prisma.$transaction(async (tx) => {
    const target = await tx.staffUser.update({
      where: { id: targetUserId },
      data: { status: "DISABLED" },
    });
    await recordAuditLog(tx, {
      tenantId: actor.tenantId,
      actorType: "STAFF",
      actorId: actor.id,
      actorLabel: actor.label,
      action: AUDIT_ACTIONS.STAFF_USER_DISABLED,
      entityType: "STAFF_USER",
      entityId: target.id,
    });
    // Any existing sessions become unusable next time they're checked.
    await tx.staffSession.updateMany({
      where: { userId: targetUserId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: "account_disabled" },
    });
  });
}

export async function setStaffPassword(token: string, newPassword: string): Promise<void> {
  const tokenHash = hashToken(token);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!record || record.actorType !== "STAFF" || record.consumedAt || record.expiresAt < new Date()) {
    throw new AuthenticationError({
      code: "auth.invalid_token",
      message: "This link is invalid or has expired.",
    });
  }
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.staffUser.update({
      where: { id: record.actorId },
      data: { passwordHash, mustChangePassword: false },
    }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { consumedAt: new Date() } }),
  ]);
}

/** Always resolves the same way whether or not the email has an account,
 * so the response can't be used to enumerate staff accounts. */
export async function requestStaffPasswordReset(tenantId: string, email: string): Promise<void> {
  const normalized = email.toLowerCase().trim();
  const user = await prisma.staffUser.findUnique({
    where: { tenantId_email: { tenantId, email: normalized } },
  });
  if (!user || user.status !== "ACTIVE" || user.deletedAt) return;

  const token = generateToken(32);
  await prisma.passwordResetToken.create({
    data: {
      tenantId,
      actorType: "STAFF",
      actorId: user.id,
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
      recipientName: user.name,
      resetUrl: `${env.APP_URL}/admin/reset-password?token=${token}`,
    },
    relatedEntityType: "STAFF_USER",
    relatedEntityId: user.id,
  });
}

export async function authenticateStaffUser(input: {
  tenantId: string;
  email: string;
  password: string;
  totpToken?: string;
  ip?: string;
  userAgent?: string;
}): Promise<AuthenticatedStaff> {
  const email = input.email.toLowerCase().trim();
  const user = await prisma.staffUser.findUnique({
    where: { tenantId_email: { tenantId: input.tenantId, email } },
  });

  const fail = async (reason: string): Promise<never> => {
    await recordLoginAttempt({
      tenantId: input.tenantId,
      actorType: "STAFF",
      actorId: user?.id ?? null,
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

  if (!user || user.status !== "ACTIVE" || user.deletedAt) return fail("not_found_or_disabled");
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return fail("locked");
  }

  const passwordOk = await verifyPassword(user.passwordHash, input.password);
  if (!passwordOk) {
    if (await shouldLockOut({ tenantId: input.tenantId, actorType: "STAFF", email })) {
      await prisma.staffUser.update({
        where: { id: user.id },
        data: { lockedUntil: computeLockoutExpiry() },
      });
    }
    return fail("bad_password");
  }

  if (user.twoFactorEnabled) {
    if (!input.totpToken) {
      throw new AuthenticationError({ code: "auth.totp_required", message: "Enter your 2FA code." });
    }
    const secret = decryptSecret(user.twoFactorSecret ?? "");
    const valid = await verifyTotpToken({ secret, token: input.totpToken });
    if (!valid) return fail("bad_totp");
  }

  await recordLoginAttempt({
    tenantId: input.tenantId,
    actorType: "STAFF",
    actorId: user.id,
    email,
    success: true,
    ip: input.ip,
    userAgent: input.userAgent,
  });
  await prisma.staffUser.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), lastLoginIp: input.ip, lockedUntil: null },
  });

  return {
    id: user.id,
    tenantId: input.tenantId,
    email: user.email,
    name: user.name,
    mustChangePassword: user.mustChangePassword,
  };
}

export async function beginStaff2FAEnrollment(userId: string) {
  const user = await prisma.staffUser.findUniqueOrThrow({ where: { id: userId } });
  const secret = generateTotpSecret();
  const uri = totpProvisioningUri({ secret, accountName: user.email, issuer: getEnv().APP_NAME });
  const qrCodeDataUrl = await totpQrCodeDataUrl(uri);
  // The secret is only persisted once confirmStaff2FAEnrollment succeeds,
  // so an abandoned enrollment never leaves a usable secret at rest.
  return { secret, qrCodeDataUrl };
}

export async function confirmStaff2FAEnrollment(
  userId: string,
  secret: string,
  token: string,
): Promise<string[]> {
  const valid = await verifyTotpToken({ secret, token });
  if (!valid) {
    throw new ValidationError({ code: "auth.totp_invalid", message: "That code didn't match. Try again." });
  }
  const recoveryCodes = Array.from({ length: 8 }, () => generateRecoveryCode());
  const recoveryCodeHashes = recoveryCodes.map((code) => hashToken(code));
  await prisma.staffUser.update({
    where: { id: userId },
    data: { twoFactorEnabled: true, twoFactorSecret: encryptSecret(secret), recoveryCodeHashes },
  });
  return recoveryCodes;
}

export async function disableStaff2FA(userId: string): Promise<void> {
  await prisma.staffUser.update({
    where: { id: userId },
    data: { twoFactorEnabled: false, twoFactorSecret: null, recoveryCodeHashes: [] },
  });
}
