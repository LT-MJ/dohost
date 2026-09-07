import { hashPassword } from "@hostpanel/auth/password";
import { prisma, recordAuditLog } from "@hostpanel/db";
import { AUDIT_ACTIONS } from "@hostpanel/shared/audit";
import { getEnv } from "@hostpanel/shared/config";
import { BusinessRuleError, ValidationError } from "@hostpanel/shared/errors";
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  STAFF_ROLE_KEYS,
  STAFF_ROLE_LABELS,
} from "@hostpanel/shared/permissions";

export interface BootstrapSuperAdminInput {
  name: string;
  email: string;
  password: string;
  ip?: string | null;
}

export interface BootstrapSuperAdminResult {
  tenantId: string;
  staffUserId: string;
  email: string;
}

/**
 * Replaces "run the seed script" for a real production deployment (see
 * DEPLOYMENT.md): creates the tenant if missing, the full role/permission
 * catalog, and a single super_admin StaffUser with a password the caller
 * chooses directly — nothing here ever sees or invents that password
 * outside this one request.
 *
 * Deliberately has no separate access token gating it. Its safety comes
 * from being unusable the moment any StaffUser exists for the tenant — a
 * fresh production database has none, so the window is only "before the
 * first successful submission," and the transaction below re-checks the
 * same guard to close the race between two concurrent submissions.
 */
export async function bootstrapSuperAdmin(input: BootstrapSuperAdminInput): Promise<BootstrapSuperAdminResult> {
  const email = input.email.toLowerCase().trim();
  if (input.password.length < 10) {
    throw new ValidationError({ code: "setup.weak_password", message: "Password must be at least 10 characters." });
  }

  const env = getEnv();
  const tenant = await prisma.tenant.upsert({
    where: { slug: env.DEFAULT_TENANT_SLUG },
    create: { slug: env.DEFAULT_TENANT_SLUG, name: env.APP_NAME },
    update: {},
  });

  await assertSetupNotComplete(tenant.id);

  for (const key of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      create: { key, category: key.split(".")[0] ?? "general" },
      update: {},
    });
  }
  const permissionIdByKey = new Map((await prisma.permission.findMany()).map((p) => [p.key, p.id]));

  const roleIdByKey = new Map<string, string>();
  for (const roleKey of STAFF_ROLE_KEYS) {
    const role = await prisma.role.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key: roleKey } },
      create: { tenantId: tenant.id, key: roleKey, name: STAFF_ROLE_LABELS[roleKey], isSystem: true },
      update: {},
    });
    roleIdByKey.set(roleKey, role.id);
    for (const permKey of DEFAULT_ROLE_PERMISSIONS[roleKey]) {
      const permissionId = permissionIdByKey.get(permKey);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        create: { roleId: role.id, permissionId },
        update: {},
      });
    }
  }

  const superAdminRoleId = roleIdByKey.get("super_admin");
  if (!superAdminRoleId) throw new Error("super_admin role missing after bootstrap");

  const passwordHash = await hashPassword(input.password);

  const staffUser = await prisma.$transaction(async (tx) => {
    const alreadySetUp = await tx.staffUser.count({ where: { tenantId: tenant.id } });
    if (alreadySetUp > 0) {
      throw new BusinessRuleError({
        code: "setup.already_completed",
        message: "Setup has already been completed. Sign in, or ask an existing admin for an invite.",
      });
    }
    const created = await tx.staffUser.create({
      data: {
        tenantId: tenant.id,
        email,
        name: input.name,
        roleId: superAdminRoleId,
        passwordHash,
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        mustChangePassword: false,
      },
    });
    await recordAuditLog(tx, {
      tenantId: tenant.id,
      actorType: "SYSTEM",
      actorId: null,
      actorLabel: "setup wizard",
      action: AUDIT_ACTIONS.STAFF_USER_CREATED,
      entityType: "STAFF_USER",
      entityId: created.id,
      ip: input.ip,
      afterState: { email, name: input.name, roleKey: "super_admin" },
      reason: "First-run production setup (/admin/setup)",
    });
    return created;
  });

  return { tenantId: tenant.id, staffUserId: staffUser.id, email };
}

async function assertSetupNotComplete(tenantId: string): Promise<void> {
  const existingStaffCount = await prisma.staffUser.count({ where: { tenantId } });
  if (existingStaffCount > 0) {
    throw new BusinessRuleError({
      code: "setup.already_completed",
      message: "Setup has already been completed. Sign in, or ask an existing admin for an invite.",
    });
  }
}

/** For the /admin/setup page to decide whether to show the form at all. */
export async function isSetupComplete(): Promise<boolean> {
  const env = getEnv();
  const tenant = await prisma.tenant.findUnique({ where: { slug: env.DEFAULT_TENANT_SLUG } });
  if (!tenant) return false;
  const count = await prisma.staffUser.count({ where: { tenantId: tenant.id } });
  return count > 0;
}
