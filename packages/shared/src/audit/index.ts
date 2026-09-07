/**
 * Audit log taxonomy for what Phase 1 implements. Extend this list as new
 * entities/actions gain admin mutation paths — every mutation of a
 * security- or business-sensitive record should log through here (see
 * @hostpanel/db's `recordAuditLog` helper) rather than being silently
 * skipped.
 */
export const AUDIT_ENTITY_TYPES = [
  "CLIENT",
  "CLIENT_CONTACT",
  "STAFF_USER",
  "ROLE",
  "PRODUCT_GROUP",
  "PRODUCT",
  "PRODUCT_PRICE",
  "ORDER",
  "INVOICE",
  "SYSTEM_SETTING",
  "STAFF_SESSION",
  "CLIENT_SESSION",
  "IMPERSONATION",
] as const;

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

export const AUDIT_ACTIONS = {
  CLIENT_CREATED: "client.created",
  CLIENT_UPDATED: "client.updated",
  CLIENT_STATUS_CHANGED: "client.status_changed",
  CLIENT_CONTACT_CREATED: "client.contact.created",
  CLIENT_CONTACT_UPDATED: "client.contact.updated",
  CLIENT_CONTACT_REMOVED: "client.contact.removed",
  STAFF_USER_CREATED: "staff_user.created",
  STAFF_USER_UPDATED: "staff_user.updated",
  STAFF_USER_DISABLED: "staff_user.disabled",
  ROLE_PERMISSIONS_CHANGED: "role.permissions_changed",
  PRODUCT_GROUP_CREATED: "product_group.created",
  PRODUCT_GROUP_UPDATED: "product_group.updated",
  PRODUCT_CREATED: "product.created",
  PRODUCT_UPDATED: "product.updated",
  PRODUCT_PRICE_CREATED: "product_price.created",
  ORDER_CREATED: "order.created",
  ORDER_STATUS_CHANGED: "order.status_changed",
  INVOICE_CREATED: "invoice.created",
  INVOICE_STATUS_CHANGED: "invoice.status_changed",
  INVOICE_MARKED_PAID: "invoice.marked_paid",
  SYSTEM_SETTING_UPDATED: "system_setting.updated",
  SESSION_REVOKED: "session.revoked",
  IMPERSONATION_STARTED: "impersonation.started",
  IMPERSONATION_ENDED: "impersonation.ended",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export type AuditActorType = "STAFF" | "CLIENT_CONTACT" | "SYSTEM";

export interface AuditLogInput {
  tenantId: string;
  actorType: AuditActorType;
  actorId?: string | null;
  actorLabel?: string | null;
  action: AuditAction | string;
  entityType: AuditEntityType;
  entityId: string;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
}
