import { requirePermission } from "@hostpanel/auth/rbac";
import { prisma, recordAuditLog } from "@hostpanel/db";
import { AUDIT_ACTIONS } from "@hostpanel/shared/audit";
import { PERMISSIONS } from "@hostpanel/shared/permissions";
import type { StaffActor } from "./staff";

/** Business/company profile shown on invoices — see CompanyProfile in ARCHITECTURE.md. */
export interface CompanyProfile {
  name: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  taxId?: string;
  supportEmail?: string;
}

export const COMPANY_PROFILE_SETTING_KEY = "company_profile";

export async function getSetting<T = unknown>(tenantId: string, key: string): Promise<T | null> {
  const row = await prisma.systemSetting.findUnique({ where: { tenantId_key: { tenantId, key } } });
  return (row?.value as T | undefined) ?? null;
}

export async function setSetting(
  actor: StaffActor,
  key: string,
  value: unknown,
): Promise<void> {
  requirePermission(actor, PERMISSIONS.SETTINGS_MANAGE);
  await prisma.$transaction(async (tx) => {
    const before = await tx.systemSetting.findUnique({
      where: { tenantId_key: { tenantId: actor.tenantId, key } },
    });
    const after = await tx.systemSetting.upsert({
      where: { tenantId_key: { tenantId: actor.tenantId, key } },
      create: { tenantId: actor.tenantId, key, value: value as object, updatedBy: actor.id },
      update: { value: value as object, updatedBy: actor.id },
    });
    await recordAuditLog(tx, {
      tenantId: actor.tenantId,
      actorType: "STAFF",
      actorId: actor.id,
      actorLabel: actor.label,
      action: AUDIT_ACTIONS.SYSTEM_SETTING_UPDATED,
      entityType: "SYSTEM_SETTING",
      entityId: after.id,
      beforeState: (before?.value as Record<string, unknown> | undefined) ?? undefined,
      afterState: value as Record<string, unknown>,
      metadata: { key },
    });
  });
}

export async function getCompanyProfile(tenantId: string): Promise<CompanyProfile> {
  const profile = await getSetting<CompanyProfile>(tenantId, COMPANY_PROFILE_SETTING_KEY);
  return (
    profile ?? {
      name: "HostPanel",
    }
  );
}
