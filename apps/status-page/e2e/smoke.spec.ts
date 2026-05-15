import { expect, test } from "@playwright/test";

test("landing page loads and shows the Status Page title", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Status Page/);
});
