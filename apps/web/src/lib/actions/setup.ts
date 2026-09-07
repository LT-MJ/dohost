"use server";

import { redirect } from "next/navigation";
import { bootstrapSuperAdmin } from "@hostpanel/core";
import { isAppError } from "@hostpanel/shared/errors";
import { getRequestMeta } from "@/lib/request-meta";

export interface ActionState {
  error?: string;
  success?: string;
}

export async function bootstrapSuperAdminAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!name || !email || !password) return { error: "All fields are required." };
  if (password !== confirmPassword) return { error: "Passwords don't match." };

  const { ip } = await getRequestMeta();
  try {
    await bootstrapSuperAdmin({ name, email, password, ip });
  } catch (error) {
    if (isAppError(error)) return { error: error.message };
    throw error;
  }

  redirect("/admin/login");
}
