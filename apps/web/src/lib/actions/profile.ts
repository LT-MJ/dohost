"use server";

import { revalidatePath } from "next/cache";
import { updateClientProfile } from "@hostpanel/core";
import { isAppError } from "@hostpanel/shared/errors";
import { requireClientActor } from "@/lib/session";

export interface ActionState {
  error?: string;
  success?: string;
}

export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireClientActor();
  const patch = {
    firstName: String(formData.get("firstName") ?? "").trim(),
    lastName: String(formData.get("lastName") ?? "").trim(),
    companyName: String(formData.get("companyName") ?? "").trim() || undefined,
    phone: String(formData.get("phone") ?? "").trim() || undefined,
    addressLine1: String(formData.get("addressLine1") ?? "").trim() || undefined,
    city: String(formData.get("city") ?? "").trim() || undefined,
    state: String(formData.get("state") ?? "").trim() || undefined,
    postalCode: String(formData.get("postalCode") ?? "").trim() || undefined,
    country: String(formData.get("country") ?? "").trim() || undefined,
  };
  if (!patch.firstName || !patch.lastName) return { error: "First and last name are required." };

  try {
    await updateClientProfile(actor, actor.clientId, patch);
  } catch (error) {
    if (isAppError(error)) return { error: error.message };
    throw error;
  }
  revalidatePath("/portal/profile");
  return { success: "Profile updated." };
}
