// How to create a monitor: list → create form → pick regions on the edit page.
// Saving tests the URL through the checker, hence `requires`.
import { cleanup } from "./lib/fixtures.mjs";

export const meta = {
  order: 2,
  label: "Monitor",
  title: "Create your first monitor",
  subtitle: "From zero to uptime monitoring in under a minute.",
  outroTitle: "You're monitoring.",
  outroSubtitle: "Next: wire up notifications and publish a status page.",
  requires: ["checker"],
};

const NAME = "npm Registry";

export default async function ({
  page,
  sql,
  warm,
  start,
  step,
  click,
  type,
  settle,
  expect,
  thumbnail,
}) {
  await sql(cleanup.monitor({ name: NAME }));
  await warm(["/monitors/create", "/monitors/1/edit"]);

  await start("/monitors", "Open Monitors");
  await click(page.getByRole("button", { name: "Create Monitor" }).first());
  await page.waitForURL("**/monitors/create");
  await settle();

  step("Name it and pick HTTP");
  await type(page.getByRole("textbox", { name: "Name" }), NAME);
  await click(page.getByRole("radio", { name: "HTTP" }));
  step("Paste the URL to check");
  await type(
    page.getByRole("textbox", { name: "URL" }),
    "https://registry.npmjs.org",
  );

  // The filled-in form makes a clearer thumbnail than the regions it ends on.
  await thumbnail(page.getByRole("textbox", { name: "URL" }));

  step("Save: the endpoint is tested first");
  await click(page.getByRole("button", { name: "Submit" }));
  await page.waitForURL(/\/monitors\/\d+\/edit/);
  await page.waitForLoadState("networkidle");
  await settle();

  step("Choose where to check from");
  // Defaults are random per monitor; "Select all" on one continent is stable.
  const regions = page
    .locator("form")
    .filter({ hasText: "Scheduling & Regions" });
  await click(
    regions
      .getByText(/^Europe/)
      .locator("xpath=following::button[normalize-space()='Select all'][1]"),
  );
  await click(regions.getByRole("button", { name: "Submit" }));
  await expect("Saved");
}
