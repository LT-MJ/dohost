"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  getDefaultTenant,
  registerClient,
  requestClientPasswordReset,
  requestStaffPasswordReset,
  setClientPassword,
  setStaffPassword,
  verifyClientEmail,
} from "@hostpanel/core";
import { isAppError } from "@hostpanel/shared/errors";
import { signIn, signOut } from "@/auth";
import { getRequestMeta } from "@/lib/request-meta";

export interface ActionState {
  error?: string;
  success?: string;
}

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  "auth.invalid_credentials": "Incorrect email or password.",
  "auth.locked": "Too many failed attempts. Please try again in 15 minutes.",
  "auth.totp_required": "Enter your 2FA code to continue.",
};

function extractErrorCode(resultUrl: string): string | null {
  try {
    const url = new URL(resultUrl, "http://localhost");
    if (!url.searchParams.has("error")) return null;
    return url.searchParams.get("code") ?? url.searchParams.get("error");
  } catch {
    return null;
  }
}

async function performLogin(
  actorType: "STAFF" | "CLIENT_CONTACT",
  formData: FormData,
  fallbackPath: string,
): Promise<ActionState> {
  const { ip, userAgent } = await getRequestMeta();
  const next = String(formData.get("next") || fallbackPath);

  const result = await signIn("credentials", {
    actorType,
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    totpToken: String(formData.get("totpToken") ?? ""),
    ip,
    userAgent,
    redirect: false,
  });

  const code = extractErrorCode(result);
  if (code) {
    return { error: AUTH_ERROR_MESSAGES[code] ?? "Something went wrong. Please try again." };
  }
  redirect(next.startsWith("/") ? next : fallbackPath);
}

export async function clientLoginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return performLogin("CLIENT_CONTACT", formData, "/portal");
}

export async function staffLoginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return performLogin("STAFF", formData, "/admin");
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirect: false });
  redirect("/login");
}

export async function staffLogoutAction(): Promise<void> {
  await signOut({ redirect: false });
  redirect("/admin/login");
}

const RegisterSchema = z.object({
  type: z.enum(["INDIVIDUAL", "COMPANY"]),
  companyName: z.string().optional(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.email("Enter a valid email address"),
  password: z.string().min(10, "Password must be at least 10 characters"),
  country: z.string().optional(),
});

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = RegisterSchema.safeParse({
    type: formData.get("type") || "INDIVIDUAL",
    companyName: formData.get("companyName") || undefined,
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    password: formData.get("password"),
    country: formData.get("country") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }

  const { ip } = await getRequestMeta();
  try {
    const tenant = await getDefaultTenant();
    await registerClient({ tenantId: tenant.id, ...parsed.data, ip });
  } catch (error) {
    if (isAppError(error)) return { error: error.message };
    throw error;
  }

  return {
    success: "Account created! Check your email for a link to verify your address before signing in.",
  };
}

export async function verifyEmailAction(token: string): Promise<{ error?: string }> {
  try {
    await verifyClientEmail(token);
  } catch (error) {
    if (isAppError(error)) return { error: error.message };
    throw error;
  }
  return {};
}

export async function requestClientPasswordResetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "");
  if (!email) return { error: "Enter your email address." };
  const tenant = await getDefaultTenant();
  await requestClientPasswordReset(tenant.id, email);
  return { success: "If that email has an account, we've sent a password reset link." };
}

export async function resetClientPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 10) return { error: "Password must be at least 10 characters." };
  try {
    await setClientPassword(token, password);
  } catch (error) {
    if (isAppError(error)) return { error: error.message };
    throw error;
  }
  return { success: "Password updated. You can now sign in." };
}

export async function staffRequestPasswordResetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "");
  if (!email) return { error: "Enter your email address." };
  const tenant = await getDefaultTenant();
  await requestStaffPasswordReset(tenant.id, email);
  return { success: "If that email has a staff account, we've sent a password reset link." };
}

export async function staffSetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 10) return { error: "Password must be at least 10 characters." };
  try {
    await setStaffPassword(token, password);
  } catch (error) {
    if (isAppError(error)) return { error: error.message };
    throw error;
  }
  return { success: "Password set. You can now sign in." };
}
