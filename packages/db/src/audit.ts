import type { AuditLogInput } from "@hostpanel/shared/audit";
import type { AuditActorType, Prisma, PrismaClient, StatusHistoryEntityType } from "../generated/prisma/client";

export type Db = Prisma.TransactionClient | PrismaClient;

/**
 * The only way an AuditLog row should ever be created. Never call
 * `prisma.auditLog.update` / `.delete` anywhere in the codebase — the
 * table is append-only from the application's perspective (section 40).
 */
export async function recordAuditLog(db: Db, input: AuditLogInput): Promise<void> {
  await db.auditLog.create({
    data: {
      tenantId: input.tenantId,
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      actorLabel: input.actorLabel ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      requestId: input.requestId ?? null,
      beforeState: (input.beforeState ?? undefined) as Prisma.InputJsonValue | undefined,
      afterState: (input.afterState ?? undefined) as Prisma.InputJsonValue | undefined,
      reason: input.reason ?? null,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

export interface StatusTransitionInput {
  tenantId: string;
  entityType: StatusHistoryEntityType;
  entityId: string;
  fromStatus: string | null;
  toStatus: string;
  actorType: AuditActorType;
  actorId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Records a state-machine transition (section 54). Domain services call
 * this in the same transaction as the status write itself — the row is
 * evidence of *why* a status changed, never a substitute for validating
 * whether the transition was legal in the first place.
 */
export async function recordStatusTransition(db: Db, input: StatusTransitionInput): Promise<void> {
  await db.statusHistory.create({
    data: {
      tenantId: input.tenantId,
      entityType: input.entityType,
      entityId: input.entityId,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      reason: input.reason ?? null,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}
