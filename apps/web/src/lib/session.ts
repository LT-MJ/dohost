import { redirect } from "next/navigation";
import { cache } from "react";
import type { ClientPortalActor, StaffActor } from "@hostpanel/core";
import type { PermissionKey } from "@hostpanel/shared/permissions";
import { auth } from "@/auth";

/** Memoized per-request so multiple components reading the session in one
 * render pass don't each re-validate against the database. */
export const getSession = cache(async () => auth());

export async function getStaffActor(): Promise<StaffActor | null> {
  const session = await getSession();
  if (
    session?.actorType !== "STAFF" ||
    !session.userId ||
    !session.tenantId ||
    !session.permissions
  ) {
    return null;
  }
  return {
    type: "STAFF",
    id: session.userId,
    tenantId: session.tenantId,
    label: session.user?.name ?? session.user?.email ?? session.userId,
    permissions: session.permissions as PermissionKey[],
  };
}

export async function requireStaffActor(): Promise<StaffActor> {
  const actor = await getStaffActor();
  if (!actor) redirect("/admin/login");
  return actor;
}

export async function getClientActor(): Promise<ClientPortalActor | null> {
  const session = await getSession();
  if (session?.actorType !== "CLIENT_CONTACT" || !session.userId || !session.clientId || !session.tenantId) {
    return null;
  }
  return {
    type: "CLIENT_CONTACT",
    id: session.userId,
    clientId: session.clientId,
    tenantId: session.tenantId,
    label: session.user?.name ?? session.user?.email ?? session.userId,
    permissions: [],
  };
}

export async function requireClientActor(): Promise<ClientPortalActor> {
  const actor = await getClientActor();
  if (!actor) redirect("/login");
  return actor;
}

export async function isImpersonating(): Promise<boolean> {
  const session = await getSession();
  return Boolean(session?.impersonatedByStaffUserId);
}
