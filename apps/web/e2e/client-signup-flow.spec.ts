import { expect, test } from "@playwright/test";

const MAILPIT_URL = "http://localhost:8025";

async function findEmailLink(toAddress: string, urlPattern: RegExp, attempts = 30): Promise<string> {
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(`${MAILPIT_URL}/api/v1/messages`);
    const data = await res.json();
    const messages = (data.messages ?? []) as Array<{ ID: string; To: Array<{ Address: string }> }>;
    const msg = [...messages].reverse().find((m) => m.To?.some((t) => t.Address === toAddress));
    if (msg) {
      const detailRes = await fetch(`${MAILPIT_URL}/api/v1/message/${msg.ID}`);
      const detail = (await detailRes.json()) as { Text?: string };
      const match = detail.Text?.match(urlPattern);
      if (match) return match[0];
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No email with a matching link found for ${toAddress}`);
}

test("client can register, verify email, log in, order a product, and see the invoice", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;
  const password = "SuperSecret123!";

  await page.goto("/register");
  await page.fill("#firstName", "Test");
  await page.fill("#lastName", "User");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 10_000 });

  const verifyUrl = await findEmailLink(email, /http:\/\/localhost:3000\/verify-email\?token=[^\s]+/);
  await page.goto(verifyUrl);
  await expect(page.getByText(/verified/i)).toBeVisible();

  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/portal", { timeout: 10_000 });

  await page.goto("/portal/products");
  await expect(page.getByText("Starter", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Order Starter" }).click();
  await page.waitForURL(/\/portal\/orders\//, { timeout: 10_000 });
  await expect(page.getByText(/awaiting.?payment/i).first()).toBeVisible();
});

test("unauthenticated visitor is redirected away from the portal and admin area", async ({ page }) => {
  await page.goto("/portal");
  await expect(page).toHaveURL(/\/login\?next=/);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
});
