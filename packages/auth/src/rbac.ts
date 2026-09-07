import { AuthorizationError } from "@hostpanel/shared/errors";
import type { PermissionKey } from "@hostpanel/shared/permissions";

export interface PermissionActor {
  permissions: readonly PermissionKey[];
}

export function hasPermission(actor: PermissionActor, permission: PermissionKey): boolean {
  return actor.permissions.includes(permission);
}

export function hasAnyPermission(
  actor: PermissionActor,
  permissions: readonly PermissionKey[],
): boolean {
  return permissions.some((p) => actor.permissions.includes(p));
}

export function hasAllPermissions(
  actor: PermissionActor,
  permissions: readonly PermissionKey[],
): boolean {
  return permissions.every((p) => actor.permissions.includes(p));
}

/**
 * Server-side authorization gate. Call this at the top of every domain
 * service method / API route / server action that performs a
 * security-sensitive action — never rely on the UI hiding a button as the
 * only protection (client-side checks are UX only).
 */
export function requirePermission(actor: PermissionActor, permission: PermissionKey): void {
  if (!hasPermission(actor, permission)) {
    throw new AuthorizationError({
      code: "authorization.permission_denied",
      message: "You do not have permission to perform this action.",
      meta: { requiredPermission: permission },
    });
  }
}
