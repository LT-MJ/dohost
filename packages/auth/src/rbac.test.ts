import { describe, expect, it } from "vitest";
import { AuthorizationError } from "@hostpanel/shared/errors";
import { PERMISSIONS } from "@hostpanel/shared/permissions";
import { hasAllPermissions, hasAnyPermission, hasPermission, requirePermission } from "./rbac";

const readOnlyActor = { permissions: [PERMISSIONS.CLIENTS_READ, PERMISSIONS.ORDERS_READ] };
const billingActor = {
  permissions: [PERMISSIONS.CLIENTS_READ, PERMISSIONS.INVOICES_READ, PERMISSIONS.INVOICES_WRITE],
};

describe("rbac", () => {
  it("hasPermission checks exact membership", () => {
    expect(hasPermission(readOnlyActor, PERMISSIONS.CLIENTS_READ)).toBe(true);
    expect(hasPermission(readOnlyActor, PERMISSIONS.CLIENTS_WRITE)).toBe(false);
  });

  it("hasAnyPermission is true if at least one matches", () => {
    expect(hasAnyPermission(readOnlyActor, [PERMISSIONS.CLIENTS_WRITE, PERMISSIONS.ORDERS_READ])).toBe(true);
    expect(hasAnyPermission(readOnlyActor, [PERMISSIONS.CLIENTS_WRITE, PERMISSIONS.STAFF_MANAGE])).toBe(false);
  });

  it("hasAllPermissions requires every permission to be present", () => {
    expect(hasAllPermissions(billingActor, [PERMISSIONS.INVOICES_READ, PERMISSIONS.INVOICES_WRITE])).toBe(true);
    expect(hasAllPermissions(billingActor, [PERMISSIONS.INVOICES_WRITE, PERMISSIONS.STAFF_MANAGE])).toBe(false);
  });

  it("requirePermission passes through silently when granted", () => {
    expect(() => requirePermission(billingActor, PERMISSIONS.INVOICES_WRITE)).not.toThrow();
  });

  it("requirePermission throws a safe AuthorizationError when denied", () => {
    expect(() => requirePermission(readOnlyActor, PERMISSIONS.STAFF_MANAGE)).toThrow(AuthorizationError);
    try {
      requirePermission(readOnlyActor, PERMISSIONS.STAFF_MANAGE);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(AuthorizationError);
      const authError = error as AuthorizationError;
      expect(authError.category).toBe("authorization");
      expect(authError.message).not.toContain("staff.manage");
    }
  });
});
