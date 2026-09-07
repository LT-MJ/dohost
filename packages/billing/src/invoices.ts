import { requirePermission } from "@hostpanel/auth/rbac";
import { getCompanyProfile, type StaffActor } from "@hostpanel/core";
import { prisma, recordAuditLog, recordStatusTransition } from "@hostpanel/db";
import type { Invoice, InvoiceStatus, Order, OrderItem, Prisma } from "@hostpanel/db";
import { AUDIT_ACTIONS } from "@hostpanel/shared/audit";
import { BusinessRuleError } from "@hostpanel/shared/errors";
import { add, money } from "@hostpanel/shared/money";
import { PERMISSIONS } from "@hostpanel/shared/permissions";
import { nextSequenceNumber } from "./numbering";
import { transitionOrderStatus } from "./orders";

const INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  DRAFT: ["ISSUED", "CANCELLED"],
  ISSUED: ["PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"],
  UNPAID: ["PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"],
  PARTIALLY_PAID: ["PAID", "OVERDUE", "COLLECTIONS", "CANCELLED"],
  OVERDUE: ["PARTIALLY_PAID", "PAID", "COLLECTIONS", "CANCELLED"],
  COLLECTIONS: ["PAID", "CANCELLED"],
  PAID: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

/** Default net terms until the (Phase 6) dunning/tax engine makes this configurable. */
const DEFAULT_NET_TERMS_DAYS = 7;

type TransitionActor = { type: "STAFF" | "CLIENT_CONTACT" | "SYSTEM"; id: string | null; label?: string };

async function transitionInvoiceStatus(
  tx: Prisma.TransactionClient,
  invoiceId: string,
  toStatus: InvoiceStatus,
  actor: TransitionActor,
  reason?: string,
): Promise<Invoice> {
  const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
  const allowed = INVOICE_TRANSITIONS[invoice.status] ?? [];
  if (!allowed.includes(toStatus)) {
    throw new BusinessRuleError({
      code: "invoice.invalid_transition",
      message: `Cannot move an invoice from ${invoice.status} to ${toStatus}.`,
    });
  }
  const updated = await tx.invoice.update({ where: { id: invoiceId }, data: { status: toStatus } });
  await recordStatusTransition(tx, {
    tenantId: invoice.tenantId,
    entityType: "INVOICE",
    entityId: invoiceId,
    fromStatus: invoice.status,
    toStatus,
    actorType: actor.type,
    actorId: actor.id,
    reason,
  });
  return updated;
}

/**
 * Issues an invoice from a paid-eligible order, snapshotting client and
 * company details at issue time (section 17) — later edits to the Client
 * record or company settings never rewrite an already-issued invoice.
 */
export async function issueInvoiceForOrder(
  order: Order & { items: OrderItem[] },
  actor: TransitionActor,
): Promise<Invoice> {
  return prisma.$transaction(async (tx) => {
    const client = await tx.client.findUniqueOrThrow({ where: { id: order.clientId } });
    const company = await getCompanyProfile(order.tenantId);

    const invoiceNumber = await nextSequenceNumber(tx, order.tenantId, "invoice_number", {
      prefix: "INV-",
      padding: 6,
    });
    const dueDate = new Date(Date.now() + DEFAULT_NET_TERMS_DAYS * 24 * 60 * 60 * 1000);

    const invoice = await tx.invoice.create({
      data: {
        tenantId: order.tenantId,
        clientId: order.clientId,
        orderId: order.id,
        invoiceNumber,
        status: "ISSUED",
        currency: order.currency,
        subtotal: order.subtotal,
        discountTotal: order.discountTotal,
        taxTotal: order.taxTotal,
        total: order.total,
        amountPaid: 0,
        amountDue: order.total,
        dueDate,
        issuedAt: new Date(),
        customerSnapshot: {
          name: client.companyName || `${client.firstName} ${client.lastName}`,
          email: client.email,
          addressLine1: client.addressLine1,
          addressLine2: client.addressLine2,
          city: client.city,
          state: client.state,
          postalCode: client.postalCode,
          country: client.country,
          taxId: client.taxId,
        },
        companySnapshot: { ...company },
        items: {
          createMany: {
            data: order.items.map((item) => ({
              tenantId: order.tenantId,
              sourceOrderItemId: item.id,
              description: item.descriptionSnapshot
                ? `${item.productNameSnapshot} — ${item.descriptionSnapshot}`
                : item.productNameSnapshot,
              quantity: item.quantity,
              unitPrice: item.unitPriceSnapshot,
              taxAmount: item.taxSnapshot,
              discountAmount: item.discountSnapshot,
              lineTotal: item.lineTotal + item.setupFeeSnapshot,
            })),
          },
        },
      },
    });

    await recordStatusTransition(tx, {
      tenantId: order.tenantId,
      entityType: "INVOICE",
      entityId: invoice.id,
      fromStatus: null,
      toStatus: "ISSUED",
      actorType: actor.type,
      actorId: actor.id,
    });
    await recordAuditLog(tx, {
      tenantId: order.tenantId,
      actorType: actor.type,
      actorId: actor.id,
      actorLabel: actor.label,
      action: AUDIT_ACTIONS.INVOICE_CREATED,
      entityType: "INVOICE",
      entityId: invoice.id,
      afterState: { invoiceNumber, total: order.total, currency: order.currency },
    });

    if (order.status === "PENDING") {
      await transitionOrderStatus(tx, order.id, "AWAITING_PAYMENT", actor, "invoice_issued");
    }

    return invoice;
  });
}

/**
 * Phase 1's only "payment" path: staff manually confirm money arrived
 * (e.g. a bank transfer) and record it against the invoice. This is the
 * documented manual fallback until Phase 2 wires up a real gateway +
 * ledger — see ARCHITECTURE.md. Never callable by a client themselves.
 */
export async function markInvoicePaidManually(
  actor: StaffActor,
  invoiceId: string,
  input: { amount: number; reference?: string; reason?: string },
): Promise<Invoice> {
  requirePermission(actor, PERMISSIONS.INVOICES_WRITE);
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new BusinessRuleError({
      code: "invoice.invalid_amount",
      message: "Payment amount must be a positive whole number of minor currency units.",
    });
  }

  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    if (!["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status)) {
      throw new BusinessRuleError({
        code: "invoice.not_payable",
        message: `Invoice is ${invoice.status} and cannot accept a payment.`,
      });
    }

    const currentPaid = money(invoice.amountPaid, invoice.currency);
    const payment = money(input.amount, invoice.currency);
    const newPaid = add(currentPaid, payment);
    const total = money(invoice.total, invoice.currency);
    if (newPaid.amount > total.amount) {
      throw new BusinessRuleError({
        code: "invoice.overpayment",
        message: "That payment would exceed the invoice total — record the excess as account credit instead.",
      });
    }
    const newDue = total.amount - newPaid.amount;
    const nextStatus: InvoiceStatus = newDue === 0 ? "PAID" : "PARTIALLY_PAID";

    const updated = await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        amountPaid: newPaid.amount,
        amountDue: newDue,
        status: nextStatus,
        paidAt: nextStatus === "PAID" ? new Date() : invoice.paidAt,
      },
    });
    await recordStatusTransition(tx, {
      tenantId: invoice.tenantId,
      entityType: "INVOICE",
      entityId: invoiceId,
      fromStatus: invoice.status,
      toStatus: nextStatus,
      actorType: "STAFF",
      actorId: actor.id,
      reason: input.reason ?? "manual_payment_recorded",
      metadata: { amount: input.amount, reference: input.reference },
    });
    await recordAuditLog(tx, {
      tenantId: invoice.tenantId,
      actorType: "STAFF",
      actorId: actor.id,
      actorLabel: actor.label,
      action: AUDIT_ACTIONS.INVOICE_MARKED_PAID,
      entityType: "INVOICE",
      entityId: invoiceId,
      afterState: { amountPaid: newPaid.amount, status: nextStatus },
      reason: input.reason,
      metadata: { reference: input.reference },
    });

    if (nextStatus === "PAID" && invoice.orderId) {
      await transitionOrderStatus(
        tx,
        invoice.orderId,
        "PAID",
        { type: "STAFF", id: actor.id, label: actor.label },
        "invoice_paid",
      );
    }

    return updated;
  });
}

export async function cancelInvoice(actor: StaffActor, invoiceId: string, reason: string): Promise<Invoice> {
  requirePermission(actor, PERMISSIONS.INVOICES_WRITE);
  return prisma.$transaction(async (tx) => {
    const updated = await transitionInvoiceStatus(
      tx,
      invoiceId,
      "CANCELLED",
      { type: "STAFF", id: actor.id, label: actor.label },
      reason,
    );
    await recordAuditLog(tx, {
      tenantId: actor.tenantId,
      actorType: "STAFF",
      actorId: actor.id,
      actorLabel: actor.label,
      action: AUDIT_ACTIONS.INVOICE_STATUS_CHANGED,
      entityType: "INVOICE",
      entityId: invoiceId,
      afterState: { status: "CANCELLED" },
      reason,
    });
    return updated;
  });
}
