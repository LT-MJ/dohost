"use server";

import { revalidatePath } from "next/cache";
import {
  addClientNote,
  changeClientStatus,
  COMPANY_PROFILE_SETTING_KEY,
  createProduct,
  createProductGroup,
  createStaffUser,
  setProductPrice,
  setSetting,
} from "@hostpanel/core";
import { markInvoicePaidManually } from "@hostpanel/billing";
import type { ClientStatus } from "@hostpanel/db";
import { isAppError } from "@hostpanel/shared/errors";
import { fromDecimalString, MoneyError } from "@hostpanel/shared/money";
import type { StaffRoleKey } from "@hostpanel/shared/permissions";
import { requireStaffActor } from "@/lib/session";

export interface ActionState {
  error?: string;
  success?: string;
}

function parseUsdAmount(input: string): number | { error: string } {
  try {
    return fromDecimalString(input, "USD").amount;
  } catch (error) {
    if (error instanceof MoneyError) return { error: error.message };
    throw error;
  }
}

export async function addClientNoteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireStaffActor();
  const clientId = String(formData.get("clientId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Note cannot be empty." };
  try {
    await addClientNote(actor, clientId, body);
  } catch (error) {
    if (isAppError(error)) return { error: error.message };
    throw error;
  }
  revalidatePath(`/admin/clients/${clientId}`);
  return { success: "Note added." };
}

export async function changeClientStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireStaffActor();
  const clientId = String(formData.get("clientId") ?? "");
  const status = String(formData.get("status") ?? "") as ClientStatus;
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { error: "A reason is required for status changes." };
  try {
    await changeClientStatus(actor, clientId, status, reason);
  } catch (error) {
    if (isAppError(error)) return { error: error.message };
    throw error;
  }
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/clients");
  return { success: `Client status changed to ${status}.` };
}

export async function createStaffUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireStaffActor();
  const email = String(formData.get("email") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const roleKey = String(formData.get("roleKey") ?? "") as StaffRoleKey;
  if (!email || !name || !roleKey) return { error: "All fields are required." };
  try {
    await createStaffUser(actor, { email, name, roleKey });
  } catch (error) {
    if (isAppError(error)) return { error: error.message };
    throw error;
  }
  revalidatePath("/admin/staff");
  return { success: `Invited ${email}.` };
}

export async function createProductGroupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireStaffActor();
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  if (!name || !slug) return { error: "Name and slug are required." };
  try {
    await createProductGroup(actor, { name, slug });
  } catch (error) {
    if (isAppError(error)) return { error: error.message };
    throw error;
  }
  revalidatePath("/admin/products");
  return { success: "Product group created." };
}

export async function createProductAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireStaffActor();
  const productGroupId = String(formData.get("productGroupId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || undefined;
  const monthlyPriceInput = String(formData.get("monthlyPrice") ?? "").trim();
  if (!productGroupId || !name || !slug) return { error: "Group, name, and slug are required." };

  const price = monthlyPriceInput ? parseUsdAmount(monthlyPriceInput) : 0;
  if (typeof price === "object") return price;

  try {
    const product = await createProduct(actor, { productGroupId, name, slug, description });
    if (monthlyPriceInput) {
      await setProductPrice(actor, {
        productId: product.id,
        currency: "USD",
        billingCycle: "MONTHLY",
        price,
      });
    }
  } catch (error) {
    if (isAppError(error)) return { error: error.message };
    throw error;
  }
  revalidatePath("/admin/products");
  return { success: "Product created." };
}

export async function markInvoicePaidAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireStaffActor();
  const invoiceId = String(formData.get("invoiceId") ?? "");
  const amountInput = String(formData.get("amount") ?? "").trim();
  const reference = String(formData.get("reference") ?? "").trim() || undefined;
  if (!invoiceId || !amountInput) return { error: "Amount is required." };

  const amount = parseUsdAmount(amountInput);
  if (typeof amount === "object") return amount;

  try {
    await markInvoicePaidManually(actor, invoiceId, {
      amount,
      reference,
      reason: "manual_bank_transfer",
    });
  } catch (error) {
    if (isAppError(error)) return { error: error.message };
    throw error;
  }
  revalidatePath(`/admin/invoices/${invoiceId}`);
  revalidatePath("/admin/invoices");
  return { success: "Payment recorded." };
}

export async function updateCompanyProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireStaffActor();
  const profile = {
    name: String(formData.get("name") ?? "").trim(),
    addressLine1: String(formData.get("addressLine1") ?? "").trim() || undefined,
    city: String(formData.get("city") ?? "").trim() || undefined,
    state: String(formData.get("state") ?? "").trim() || undefined,
    postalCode: String(formData.get("postalCode") ?? "").trim() || undefined,
    country: String(formData.get("country") ?? "").trim() || undefined,
    taxId: String(formData.get("taxId") ?? "").trim() || undefined,
    supportEmail: String(formData.get("supportEmail") ?? "").trim() || undefined,
  };
  if (!profile.name) return { error: "Company name is required." };
  try {
    await setSetting(actor, COMPANY_PROFILE_SETTING_KEY, profile);
  } catch (error) {
    if (isAppError(error)) return { error: error.message };
    throw error;
  }
  revalidatePath("/admin/settings");
  return { success: "Settings saved." };
}
