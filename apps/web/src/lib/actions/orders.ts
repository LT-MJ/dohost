"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createOrder, issueInvoiceForOrder } from "@hostpanel/billing";
import type { BillingCycle } from "@hostpanel/db";
import { isAppError } from "@hostpanel/shared/errors";
import { getRequestMeta } from "@/lib/request-meta";
import { requireClientActor } from "@/lib/session";

export interface ActionState {
  error?: string;
}

export async function placeOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireClientActor();
  const productId = String(formData.get("productId") ?? "");
  const billingCycle = String(formData.get("billingCycle") ?? "MONTHLY") as BillingCycle;
  if (!productId) return { error: "Choose a product to order." };

  const { ip, userAgent } = await getRequestMeta();
  const idempotencyKey = String(formData.get("idempotencyKey") ?? randomUUID());

  let orderId: string;
  try {
    const order = await createOrder(actor, {
      clientId: actor.clientId,
      currency: "USD",
      items: [{ productId, quantity: 1, billingCycle }],
      idempotencyKey,
      ipAddress: ip,
      userAgent,
    });
    await issueInvoiceForOrder(order, { type: "CLIENT_CONTACT", id: actor.id, label: actor.label });
    orderId = order.id;
  } catch (error) {
    if (isAppError(error)) return { error: error.message };
    throw error;
  }

  revalidatePath("/portal/orders");
  revalidatePath("/portal");
  redirect(`/portal/orders/${orderId}`);
}
