import { expect, test } from "@playwright/test";

test("seeded status page renders for /acme/en", async ({ page }) => {
  const response = await page.goto("/acme/en");
  expect(response?.status()).toBe(200);
  await expect(page.getByText("Acme Inc.")).toBeVisible();
});
