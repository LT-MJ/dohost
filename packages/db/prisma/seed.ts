import { existsSync } from "node:fs";
import path from "node:path";
import { hashPassword } from "@hostpanel/auth/password";
import { createOrder, issueInvoiceForOrder } from "@hostpanel/billing";
import type { StaffActor } from "@hostpanel/core";
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
  STAFF_ROLE_KEYS,
  STAFF_ROLE_LABELS,
} from "@hostpanel/shared/permissions";
import { prisma } from "../src/client";

const rootEnvPath = path.resolve(import.meta.dirname, "../../../.env");
if (existsSync(rootEnvPath) && !process.env.DATABASE_URL) {
  process.loadEnvFile(rootEnvPath);
}

const SEED_ADMIN_EMAIL = "admin@example.com";
const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";
const SEED_CLIENT_EMAIL = "client@example.com";
const SEED_CLIENT_PASSWORD = process.env.SEED_CLIENT_PASSWORD ?? "ChangeMe123!";

function permissionCategory(key: string): string {
  return key.split(".")[0] ?? "general";
}

async function main() {
  console.log("Seeding HostPanel Phase 1 data...");

  // --- Tenant -------------------------------------------------------------
  const slug = process.env.DEFAULT_TENANT_SLUG ?? "default";
  const tenant = await prisma.tenant.upsert({
    where: { slug },
    create: { slug, name: process.env.APP_NAME ?? "HostPanel" },
    update: {},
  });

  // --- Permission catalog ---------------------------------------------------
  for (const key of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      create: { key, category: permissionCategory(key) },
      update: { category: permissionCategory(key) },
    });
  }
  const permissionRows = await prisma.permission.findMany();
  const permissionIdByKey = new Map(permissionRows.map((p) => [p.key, p.id]));

  // --- Roles + role/permission mappings ------------------------------------
  const roleIdByKey = new Map<string, string>();
  for (const roleKey of STAFF_ROLE_KEYS) {
    const role = await prisma.role.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key: roleKey } },
      create: { tenantId: tenant.id, key: roleKey, name: STAFF_ROLE_LABELS[roleKey], isSystem: true },
      update: { name: STAFF_ROLE_LABELS[roleKey] },
    });
    roleIdByKey.set(roleKey, role.id);

    const grantedKeys = DEFAULT_ROLE_PERMISSIONS[roleKey];
    for (const permKey of grantedKeys) {
      const permissionId = permissionIdByKey.get(permKey);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        create: { roleId: role.id, permissionId },
        update: {},
      });
    }
  }

  // --- Super admin staff user -----------------------------------------------
  const superAdminRoleId = roleIdByKey.get("super_admin");
  if (!superAdminRoleId) throw new Error("super_admin role missing after seeding roles");

  const passwordHash = await hashPassword(SEED_ADMIN_PASSWORD);
  const admin = await prisma.staffUser.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: SEED_ADMIN_EMAIL } },
    create: {
      tenantId: tenant.id,
      email: SEED_ADMIN_EMAIL,
      name: "Alex Admin",
      passwordHash,
      roleId: superAdminRoleId,
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      mustChangePassword: true,
    },
    update: {},
  });

  await prisma.staffUser.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "support@example.com" } },
    create: {
      tenantId: tenant.id,
      email: "support@example.com",
      name: "Sam Support",
      passwordHash: await hashPassword(SEED_ADMIN_PASSWORD),
      roleId: roleIdByKey.get("support_staff")!,
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      mustChangePassword: true,
    },
    update: {},
  });

  await prisma.staffUser.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "billing@example.com" } },
    create: {
      tenantId: tenant.id,
      email: "billing@example.com",
      name: "Bailey Billing",
      passwordHash: await hashPassword(SEED_ADMIN_PASSWORD),
      roleId: roleIdByKey.get("billing_staff")!,
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      mustChangePassword: true,
    },
    update: {},
  });

  // --- Client group ---------------------------------------------------------
  const retailGroup = await prisma.clientGroup.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "Retail" } },
    create: { tenantId: tenant.id, name: "Retail", isDefault: true },
    update: {},
  });

  // --- Sample client + primary contact --------------------------------------
  const client = await prisma.client.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: SEED_CLIENT_EMAIL } },
    create: {
      tenantId: tenant.id,
      type: "INDIVIDUAL",
      firstName: "Casey",
      lastName: "Client",
      email: SEED_CLIENT_EMAIL,
      country: "US",
      currency: "USD",
      clientGroupId: retailGroup.id,
      status: "ACTIVE",
      verificationStatus: "VERIFIED",
    },
    update: {},
  });

  await prisma.clientContact.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: SEED_CLIENT_EMAIL } },
    create: {
      tenantId: tenant.id,
      clientId: client.id,
      email: SEED_CLIENT_EMAIL,
      passwordHash: await hashPassword(SEED_CLIENT_PASSWORD),
      firstName: "Casey",
      lastName: "Client",
      isPrimary: true,
      permBilling: true,
      permSupport: true,
      permDomains: true,
      permServices: true,
      emailVerifiedAt: new Date(),
    },
    update: {},
  });

  // --- Product catalog --------------------------------------------------------
  const hostingGroup = await prisma.productGroup.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: "shared-hosting" } },
    create: { tenantId: tenant.id, name: "Shared Hosting", slug: "shared-hosting", sortOrder: 1 },
    update: {},
  });

  const productDefs = [
    { slug: "starter", name: "Starter", description: "1 website, 10GB storage", monthly: 499, annual: 4999 },
    { slug: "business", name: "Business", description: "10 websites, 50GB storage", monthly: 1499, annual: 14999 },
    {
      slug: "enterprise",
      name: "Enterprise",
      description: "Unlimited websites, 200GB storage",
      monthly: 4999,
      annual: 49999,
    },
  ];

  const products = [];
  for (const [index, def] of productDefs.entries()) {
    const product = await prisma.product.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: def.slug } },
      create: {
        tenantId: tenant.id,
        productGroupId: hostingGroup.id,
        name: def.name,
        slug: def.slug,
        description: def.description,
        sortOrder: index,
      },
      update: { description: def.description },
    });
    products.push({ product, def });

    for (const [billingCycle, price] of [
      ["MONTHLY", def.monthly],
      ["ANNUAL", def.annual],
    ] as const) {
      const existingPrice = await prisma.productPrice.findFirst({
        where: {
          tenantId: tenant.id,
          productId: product.id,
          currency: "USD",
          billingCycle,
          clientGroupId: null,
          effectiveTo: null,
        },
      });
      if (!existingPrice) {
        await prisma.productPrice.create({
          data: {
            tenantId: tenant.id,
            productId: product.id,
            currency: "USD",
            billingCycle,
            price,
            setupFee: 0,
          },
        });
      }
    }
  }

  // --- Demo order + invoice, exercised through the real domain services -----
  const adminActor: StaffActor = {
    type: "STAFF",
    id: admin.id,
    tenantId: tenant.id,
    label: `${admin.name} <${admin.email}>`,
    permissions: [PERMISSIONS.ORDERS_WRITE, PERMISSIONS.INVOICES_WRITE],
  };

  const existingDemoOrder = await prisma.order.findFirst({
    where: { tenantId: tenant.id, clientId: client.id, idempotencyKey: "seed-demo-order" },
  });
  if (!existingDemoOrder) {
    const starter = products.find((p) => p.def.slug === "starter")!;
    const order = await createOrder(adminActor, {
      clientId: client.id,
      currency: "USD",
      items: [{ productId: starter.product.id, quantity: 1, billingCycle: "MONTHLY" }],
      idempotencyKey: "seed-demo-order",
    });
    await issueInvoiceForOrder(order, { type: "STAFF", id: admin.id, label: adminActor.label });
  }

  console.log("Seed complete.");
  console.log("");
  console.log("Dev login credentials (change on first login):");
  console.log(`  Admin:   ${SEED_ADMIN_EMAIL} / ${SEED_ADMIN_PASSWORD}`);
  console.log(`  Client:  ${SEED_CLIENT_EMAIL} / ${SEED_CLIENT_PASSWORD}`);
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
