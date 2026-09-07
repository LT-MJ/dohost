import { requirePermission } from "@hostpanel/auth/rbac";
import { prisma, recordAuditLog } from "@hostpanel/db";
import type { BillingCycle } from "@hostpanel/db";
import { AUDIT_ACTIONS } from "@hostpanel/shared/audit";
import { PERMISSIONS } from "@hostpanel/shared/permissions";
import type { StaffActor } from "./staff";

export async function createProductGroup(
  actor: StaffActor,
  input: { name: string; slug: string; description?: string; sortOrder?: number },
) {
  requirePermission(actor, PERMISSIONS.PRODUCTS_WRITE);
  return prisma.$transaction(async (tx) => {
    const group = await tx.productGroup.create({
      data: { tenantId: actor.tenantId, ...input },
    });
    await recordAuditLog(tx, {
      tenantId: actor.tenantId,
      actorType: "STAFF",
      actorId: actor.id,
      actorLabel: actor.label,
      action: AUDIT_ACTIONS.PRODUCT_GROUP_CREATED,
      entityType: "PRODUCT_GROUP",
      entityId: group.id,
      afterState: input,
    });
    return group;
  });
}

export async function createProduct(
  actor: StaffActor,
  input: {
    productGroupId: string;
    name: string;
    slug: string;
    description?: string;
    stockLimit?: number;
    sortOrder?: number;
  },
) {
  requirePermission(actor, PERMISSIONS.PRODUCTS_WRITE);
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.create({ data: { tenantId: actor.tenantId, ...input } });
    await recordAuditLog(tx, {
      tenantId: actor.tenantId,
      actorType: "STAFF",
      actorId: actor.id,
      actorLabel: actor.label,
      action: AUDIT_ACTIONS.PRODUCT_CREATED,
      entityType: "PRODUCT",
      entityId: product.id,
      afterState: input,
    });
    return product;
  });
}

/**
 * Inserts a new versioned price row and closes out whichever previous row
 * was covering the same (product, currency, billingCycle, clientGroup)
 * combination — the old row's values are never mutated, only its
 * effectiveTo is set, so anything that already snapshotted it (OrderItem,
 * InvoiceItem) is unaffected.
 */
export async function setProductPrice(
  actor: StaffActor,
  input: {
    productId: string;
    currency: string;
    billingCycle: BillingCycle;
    price: number;
    setupFee?: number;
    clientGroupId?: string;
    isPromotional?: boolean;
    effectiveFrom?: Date;
  },
) {
  requirePermission(actor, PERMISSIONS.PRODUCTS_WRITE);
  const effectiveFrom = input.effectiveFrom ?? new Date();

  return prisma.$transaction(async (tx) => {
    const previous = await tx.productPrice.findFirst({
      where: {
        tenantId: actor.tenantId,
        productId: input.productId,
        currency: input.currency,
        billingCycle: input.billingCycle,
        clientGroupId: input.clientGroupId ?? null,
        effectiveTo: null,
      },
      orderBy: { effectiveFrom: "desc" },
    });
    if (previous) {
      await tx.productPrice.update({ where: { id: previous.id }, data: { effectiveTo: effectiveFrom } });
    }
    const created = await tx.productPrice.create({
      data: {
        tenantId: actor.tenantId,
        productId: input.productId,
        currency: input.currency,
        billingCycle: input.billingCycle,
        price: input.price,
        setupFee: input.setupFee ?? 0,
        clientGroupId: input.clientGroupId,
        isPromotional: input.isPromotional ?? false,
        effectiveFrom,
      },
    });
    await recordAuditLog(tx, {
      tenantId: actor.tenantId,
      actorType: "STAFF",
      actorId: actor.id,
      actorLabel: actor.label,
      action: AUDIT_ACTIONS.PRODUCT_PRICE_CREATED,
      entityType: "PRODUCT_PRICE",
      entityId: created.id,
      afterState: { ...input, effectiveFrom },
      metadata: previous ? { closedPreviousPriceId: previous.id } : undefined,
    });
    return created;
  });
}

export async function getCurrentPrice(
  tenantId: string,
  productId: string,
  currency: string,
  billingCycle: BillingCycle,
  clientGroupId?: string | null,
) {
  const now = new Date();
  const where = {
    tenantId,
    productId,
    currency,
    billingCycle,
    effectiveFrom: { lte: now },
    OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
  };

  if (clientGroupId) {
    const groupPrice = await prisma.productPrice.findFirst({
      where: { ...where, clientGroupId },
      orderBy: { effectiveFrom: "desc" },
    });
    if (groupPrice) return groupPrice;
  }

  return prisma.productPrice.findFirst({
    where: { ...where, clientGroupId: null },
    orderBy: { effectiveFrom: "desc" },
  });
}

export async function listPublicCatalog(tenantId: string, currency = "USD") {
  const groups = await prisma.productGroup.findMany({
    where: { tenantId, visibility: "PUBLIC", deletedAt: null },
    orderBy: { sortOrder: "asc" },
    include: {
      products: {
        where: { visibility: "PUBLIC", status: "ACTIVE", deletedAt: null },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  const result = [];
  for (const group of groups) {
    const products = [];
    for (const product of group.products) {
      const monthlyPrice = await getCurrentPrice(tenantId, product.id, currency, "MONTHLY");
      const annualPrice = await getCurrentPrice(tenantId, product.id, currency, "ANNUAL");
      const oneTimePrice = await getCurrentPrice(tenantId, product.id, currency, "ONE_TIME");
      products.push({ product, monthlyPrice, annualPrice, oneTimePrice });
    }
    result.push({ group, products });
  }
  return result;
}
