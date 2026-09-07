import { expect, test } from "@playwright/test";

const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";
const CLIENT_EMAIL = "client@example.com";
const CLIENT_PASSWORD = process.env.SEED_CLIENT_PASSWORD ?? "ChangeMe123!";

async function staffLogin(page: import("@playwright/test").Page, email: string) {
  await page.goto("/admin/login");
  await page.fill("#email", email);
  await page.fill("#password", ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/admin", { timeout: 10_000 });
}

test("staff can sign in and reach the dashboard", async ({ page }) => {
  await staffLogin(page, ADMIN_EMAIL);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
});

test("staff can add a client note and record a fresh invoice payment", async ({ page }) => {
  // Place a brand-new order as the seeded client so this test never depends
  // on (or is broken by) state left over from a previous run.
  await page.goto("/login");
  await page.fill("#email", CLIENT_EMAIL);
  await page.fill("#password", CLIENT_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/portal", { timeout: 10_000 });

  await page.goto("/portal/products");
  await page.getByRole("button", { name: "Order Starter" }).click();
  await page.waitForURL(/\/portal\/orders\/(.+)/, { timeout: 10_000 });
  const orderId = new URL(page.url()).pathname.split("/").pop();

  // Logging in as staff below overwrites the client session cookie, so an
  // explicit client sign-out isn't needed first.
  await staffLogin(page, ADMIN_EMAIL);

  await page.goto("/admin/clients");
  await page.getByRole("link", { name: /Casey Client/i }).click();
  await page.waitForURL(/\/admin\/clients\//);

  const noteText = `Called to confirm order details (${Date.now()}).`;
  await page.getByPlaceholder("Add a note visible only to staff…").fill(noteText);
  await page.getByRole("button", { name: "Add note" }).click();
  await expect(page.getByText(noteText)).toBeVisible({ timeout: 10_000 });

  await page.goto(`/admin/orders/${orderId}`);
  await page.getByRole("link", { name: /^INV-/ }).click();
  await page.waitForURL(/\/admin\/invoices\//);

  const dueField = page.locator("#amount");
  await expect(dueField).toHaveValue("4.99");
  await page.getByRole("button", { name: "Record payment" }).click();
  // The form itself disappears once the invoice is fully paid (it only
  // renders while payable), so assert the durable outcome rather than the
  // transient toast: the invoice header badge flips to PAID.
  await expect(page.getByText("PAID", { exact: true })).toBeVisible({ timeout: 10_000 });
});

test("a support-staff account cannot see the audit log", async ({ page }) => {
  await staffLogin(page, "support@example.com");
  await page.goto("/admin/audit");
  await expect(page.getByText("Access denied")).toBeVisible();
});
