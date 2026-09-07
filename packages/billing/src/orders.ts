import { requirePermission } from "@hostpanel/auth/rbac";
import { getCurrentPrice } from "@hostpanel/core";
import type { ClientPortalActor, StaffActor } from "@hostpanel/core";
import { prisma, recordAuditLog, recordStatusTransition } from "@hostpanel/db";
import type { BillingCycle, OrderStatus, Prisma } from "@hostpanel/db";
import { AUDIT_ACTIONS } from "@hostpanel/shared/audit";
import { BusinessRuleError } from "@hostpanel/shared/errors";
import { add, money, multiply, zero } from "@hostpanel/shared/money";
import { PERMISSIONS } from "@hostpanel/shared/permissions";
import { nextSequenceNumber } from "./numbering";

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["AWAITING_PAYMENT", "CANCELLED", "FRAUD_REVIEW"],
  AWAITING_PAYMENT: ["PAID", "CANCELLED", "FAILED", "FRAUD_REVIEW"],
  PAID: ["PROCESSING", "REFUNDED", "FRAUD"],
  PROCESSING: ["ACTIVE", "FAILED"],
  ACTIVE: ["REFUNDED"],
  FRAUD_REVIEW: ["AWAITING_PAYMENT", "CANCELLED", "FRAUD"],
  CANCELLED: [],
  FRAUD: [],
  REFUNDED: [],
  FAILED: ["AWAITING_PAYMENT", "CANCELLED"],
};

/** Pure state-machine check, unit-testable without a database. */
export function isValidOrderTransition(from: OrderStatus, to: OrderStatus): boolean {
  return (ORDER_TRANSITIONS[from] ?? []).includes(to);
}

type TransitionActor = { type: "STAFF" | "CLIENT_CONTACT" | "SYSTEM"; id: string | null; label?: string };

/** The only sanctioned way order.status changes — never set it directly
 * from a route/UI/`prisma.order.update`. */
export async function transitionOrderStatus(
  tx: Prisma.TransactionClient,
  orderId: string,
  toStatus: OrderStatus,
  actor: TransitionActor,
  reason?: string,
) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
  if (!isValidOrderTransition(order.status, toStatus)) {
    throw new BusinessRuleError({
      code: "order.invalid_transition",
      message: `Cannot move an order from ${order.status} to ${toStatus}.`,
    });
  }
  const updated = await tx.order.update({ where: { id: orderId }, data: { status: toStatus } });
  await recordStatusTransition(tx, {
    tenantId: order.tenantId,
    entityType: "ORDER",
    entityId: orderId,
    fromStatus: order.status,
    toStatus,
    actorType: actor.type,
    actorId: actor.id,
    reason,
  });
  if (actor.label) {
    await recordAuditLog(tx, {
      tenantId: order.tenantId,
      actorType: actor.type,
      actorId: actor.id,
      actorLabel: actor.label,
      action: AUDIT_ACTIONS.ORDER_STATUS_CHANGED,
      entityType: "ORDER",
      entityId: orderId,
      reason,
      afterState: { status: toStatus },
    });
  }
  return updated;
}

export interface CreateOrderItemInput {
  productId: string;
  quantity: number;
  billingCycle: BillingCycle;
  domain?: string;
  selectedOptions?: Record<string, unknown>;
}

interface OrderItemRow {
  tenantId: string;
  productId: string;
  productPriceId: string;
  productNameSnapshot: string;
  descriptionSnapshot: string | null;
  quantity: number;
  unitPriceSnapshot: number;
  setupFeeSnapshot: number;
  taxSnapshot: number;
  discountSnapshot: number;
  billingCycleSnapshot: BillingCycle;
  domainSnapshot: string | null;
  selectedOptionsSnapshot: Prisma.InputJsonValue | undefined;
  lineTotal: number;
}

/**
 * Creates an order with immutable line-item snapshots (section 11).
 * Idempotent on (tenantId, idempotencyKey) — a retried submission with the
 * same key returns the original order rather than creating a duplicate
 * (section 12).
 */
export async function createOrder(
  actor: ClientPortalActor | StaffActor,
  input: {
    clientId: string;
    currency: string;
    items: CreateOrderItemInput[];
    idempotencyKey: string;
    ipAddress?: string;
    userAgent?: string;
  },
) {
  if (actor.type === "CLIENT_CONTACT" && actor.clientId !== input.clientId) {
    throw new BusinessRuleError({
      code: "order.forbidden",
      message: "You can only place orders for your own account.",
    });
  }
  if (actor.type === "STAFF") {
    requirePermission(actor, PERMISSIONS.ORDERS_WRITE);
  }
  if (input.items.length === 0) {
    throw new BusinessRuleError({ code: "order.empty", message: "An order must contain at least one item." });
  }

  const tenantId = actor.tenantId;

  const existing = await prisma.order.findUnique({
    where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: input.idempotencyKey } },
    include: { items: true },
  });
  if (existing) return existing;

  const client = await prisma.client.findUniqueOrThrow({ where: { id: input.clientId } });

  return prisma.$transaction(async (tx) => {
    let subtotal = zero(input.currency);
    const itemsData: OrderItemRow[] = [];

    for (const item of input.items) {
      const priceRow = await getCurrentPrice(
        tenantId,
        item.productId,
        input.currency,
        item.billingCycle,
        client.clientGroupId,
      );
      if (!priceRow) {
        throw new BusinessRuleError({
          code: "order.no_price",
          message: "One of the selected products is not available in that currency or billing cycle.",
        });
      }
      const product = await tx.product.findUniqueOrThrow({ where: { id: item.productId } });

      const unitPrice = money(priceRow.price, input.currency);
      const setupFee = money(priceRow.setupFee, input.currency);
      const lineTotal = add(multiply(unitPrice, item.quantity), setupFee);
      subtotal = add(subtotal, lineTotal);

      itemsData.push({
        tenantId,
        productId: product.id,
        productPriceId: priceRow.id,
        productNameSnapshot: product.name,
        descriptionSnapshot: product.description,
        quantity: item.quantity,
        unitPriceSnapshot: unitPrice.amount,
        setupFeeSnapshot: setupFee.amount,
        taxSnapshot: 0,
        discountSnapshot: 0,
        billingCycleSnapshot: item.billingCycle,
        domainSnapshot: item.domain ?? null,
        selectedOptionsSnapshot: item.selectedOptions as Prisma.InputJsonValue | undefined,
        lineTotal: lineTotal.amount,
      });
    }

    const total = subtotal; // no tax/discount engine yet — see ARCHITECTURE.md Phase 2 scope
    const orderNumber = await nextSequenceNumber(tx, tenantId, "order_number", {
      prefix: "ORD-",
      padding: 6,
    });

    const order = await tx.order.create({
      data: {
        tenantId,
        clientId: input.clientId,
        orderNumber,
        status: "PENDING",
        currency: input.currency,
        subtotal: subtotal.amount,
        discountTotal: 0,
        taxTotal: 0,
        total: total.amount,
        idempotencyKey: input.idempotencyKey,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        items: { createMany: { data: itemsData } },
      },
      include: { items: true },
    });

    await recordStatusTransition(tx, {
      tenantId,
      entityType: "ORDER",
      entityId: order.id,
      fromStatus: null,
      toStatus: "PENDING",
      actorType: actor.type,
      actorId: actor.id,
    });
    await recordAuditLog(tx, {
      tenantId,
      actorType: actor.type,
      actorId: actor.id,
      actorLabel: actor.label,
      action: AUDIT_ACTIONS.ORDER_CREATED,
      entityType: "ORDER",
      entityId: order.id,
      ip: input.ipAddress,
      afterState: { orderNumber, total: total.amount, currency: input.currency },
    });

    return order;
  });
}
