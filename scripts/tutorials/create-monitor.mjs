// How to create a monitor: list → create form → pick regions on the edit page.
// Saving tests the URL through the checker: run apps/checker locally and start
// the dashboard with CHECKER_URL and a matching CRON_SECRET.

const NAME = "npm Registry";

export default async function ({
  page,
  sql,
  warm,
  goto,
  start,
  step,
  click,
  type,
  wait,
  settle,
  expect,
}) {
  await sql([
    {
      q: "delete from monitor where name = ? and workspace_id = 1",
      params: [NAME],
    },
  ]);

  await warm(["/monitors/create", "/monitors/1/edit"]);

  await goto("/monitors");
  await start();
  step("Open Monitors");
  await wait(1200);

  await click(page.getByRole("button", { name: "Create Monitor" }).first());
  await page.waitForURL("**/monitors/create");
  await settle();
  await wait(800);

  step("Name it and pick HTTP");
  await type(page.getByRole("textbox", { name: "Name" }), NAME);
  await wait(400);
  await click(page.getByRole("radio", { name: "HTTP" }));
  await wait(600);
  step("Paste the URL to check");
  await type(
    page.getByRole("textbox", { name: "URL" }),
    "https://registry.npmjs.org",
  );
  await wait(600);

  step("Save: the endpoint is tested first");
  await click(page.getByRole("button", { name: "Submit" }));
  await page.waitForURL(/\/monitors\/\d+\/edit/);
  await page.waitForLoadState("networkidle");
  await settle();
  await wait(1200);

  step("Choose where to check from");
  // Defaults are random per monitor; "Select all" on one continent is stable.
  const regions = page
    .locator("form")
    .filter({ hasText: "Scheduling & Regions" });
  const europe = regions
    .getByText(/^Europe/)
    .locator("xpath=following::button[normalize-space()='Select all'][1]");
  await click(europe);
  await wait(500);
  await click(regions.getByRole("button", { name: "Submit" }));
  await expect("Saved");
  await wait(2000);
}
