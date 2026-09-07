import { prisma } from "@hostpanel/db";

/** Single-business Phase 1 deployments have exactly one Tenant row. */
export async function getDefaultTenant() {
  const slug = process.env.DEFAULT_TENANT_SLUG ?? "default";
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) {
    throw new Error(
      `No tenant found for slug "${slug}". Run the seed script (pnpm db:seed) before starting the app.`,
    );
  }
  return tenant;
}
