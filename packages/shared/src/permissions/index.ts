/**
 * RBAC permission catalog and default role mappings.
 *
 * Authorization checks throughout the app must go through
 * `hasPermission(actor, PERMISSIONS.X)` (see @hostpanel/auth) rather than
 * ad-hoc `if (user.role === "admin")` checks. The catalog below is scoped
 * to what Phase 1 actually implements, plus a handful of keys (payments,
 * domains, provisioning, support) that the seed data wires up now so later
 * phases only need to add the enforcement points, not redesign the schema.
 */
export const PERMISSIONS = {
  CLIENTS_READ: "clients.read",
  CLIENTS_WRITE: "clients.write",
  CLIENTS_CONTACTS_MANAGE: "clients.contacts.manage",
  CLIENTS_IMPERSONATE: "clients.impersonate",

  PRODUCTS_READ: "products.read",
  PRODUCTS_WRITE: "products.write",

  ORDERS_READ: "orders.read",
  ORDERS_WRITE: "orders.write",

  INVOICES_READ: "invoices.read",
  INVOICES_WRITE: "invoices.write",

  PAYMENTS_READ: "payments.read",
  PAYMENTS_REFUND: "payments.refund",

  DOMAINS_MANAGE: "domains.manage",
  PROVISIONING_MANAGE: "provisioning.manage",
  SUPPORT_MANAGE: "support.manage",

  STAFF_MANAGE: "staff.manage",
  ROLES_MANAGE: "roles.manage",
  SETTINGS_MANAGE: "settings.manage",

  REPORTS_FINANCE: "reports.finance",
  AUDIT_READ: "audit.read",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: PermissionKey[] = Object.values(PERMISSIONS);

export const STAFF_ROLE_KEYS = [
  "super_admin",
  "admin",
  "billing_staff",
  "support_staff",
  "sales_staff",
  "technical_staff",
  "finance_staff",
  "readonly_staff",
] as const;

export type StaffRoleKey = (typeof STAFF_ROLE_KEYS)[number];

export const STAFF_ROLE_LABELS: Record<StaffRoleKey, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  billing_staff: "Billing Staff",
  support_staff: "Support Staff",
  sales_staff: "Sales Staff",
  technical_staff: "Technical Staff",
  finance_staff: "Finance Staff",
  readonly_staff: "Read-only Staff",
};

const READ_ONLY_PERMISSIONS: PermissionKey[] = [
  PERMISSIONS.CLIENTS_READ,
  PERMISSIONS.PRODUCTS_READ,
  PERMISSIONS.ORDERS_READ,
  PERMISSIONS.INVOICES_READ,
  PERMISSIONS.PAYMENTS_READ,
  PERMISSIONS.REPORTS_FINANCE,
  PERMISSIONS.AUDIT_READ,
];

/**
 * Default permission grants seeded per role. These are starting points, not
 * hardcoded enforcement — the actual RolePermission rows in the database
 * are what authorization checks consult, and super_admin/admin can edit
 * them (see roles.manage) once the role-management UI is in place.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<StaffRoleKey, PermissionKey[]> = {
  super_admin: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS.filter((p) => p !== PERMISSIONS.ROLES_MANAGE),
  billing_staff: [
    PERMISSIONS.CLIENTS_READ,
    PERMISSIONS.ORDERS_READ,
    PERMISSIONS.INVOICES_READ,
    PERMISSIONS.INVOICES_WRITE,
    PERMISSIONS.PAYMENTS_READ,
    PERMISSIONS.PAYMENTS_REFUND,
    PERMISSIONS.REPORTS_FINANCE,
    PERMISSIONS.AUDIT_READ,
  ],
  finance_staff: [
    PERMISSIONS.CLIENTS_READ,
    PERMISSIONS.ORDERS_READ,
    PERMISSIONS.INVOICES_READ,
    PERMISSIONS.INVOICES_WRITE,
    PERMISSIONS.PAYMENTS_READ,
    PERMISSIONS.PAYMENTS_REFUND,
    PERMISSIONS.REPORTS_FINANCE,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.SETTINGS_MANAGE,
  ],
  support_staff: [
    PERMISSIONS.CLIENTS_READ,
    PERMISSIONS.CLIENTS_CONTACTS_MANAGE,
    PERMISSIONS.CLIENTS_IMPERSONATE,
    PERMISSIONS.ORDERS_READ,
    PERMISSIONS.SUPPORT_MANAGE,
  ],
  sales_staff: [
    PERMISSIONS.CLIENTS_READ,
    PERMISSIONS.CLIENTS_WRITE,
    PERMISSIONS.PRODUCTS_READ,
    PERMISSIONS.ORDERS_READ,
    PERMISSIONS.ORDERS_WRITE,
  ],
  technical_staff: [
    PERMISSIONS.CLIENTS_READ,
    PERMISSIONS.ORDERS_READ,
    PERMISSIONS.DOMAINS_MANAGE,
    PERMISSIONS.PROVISIONING_MANAGE,
    PERMISSIONS.SUPPORT_MANAGE,
  ],
  readonly_staff: READ_ONLY_PERMISSIONS,
};

/** Per-contact permission flags for a Client's sub-contacts (section 7/25). */
export interface ClientContactPermissions {
  billing: boolean;
  support: boolean;
  domains: boolean;
  services: boolean;
}

export const DEFAULT_PRIMARY_CONTACT_PERMISSIONS: ClientContactPermissions = {
  billing: true,
  support: true,
  domains: true,
  services: true,
};

export const DEFAULT_SUB_CONTACT_PERMISSIONS: ClientContactPermissions = {
  billing: false,
  support: true,
  domains: false,
  services: false,
};
