// How to create a status page: list → create form → edit page.

const SLUG = "acme-status";

export default async function ({
  page,
  sql,
  warm,
  goto,
  start,
  click,
  type,
  wait,
}) {
  // Re-runs would otherwise hit the slug-uniqueness check.
  await sql([{ q: "delete from page where slug = ?", params: [SLUG] }]);

  await warm(["/status-pages/create", "/status-pages/1/edit"]);

  await goto("/status-pages");
  start();
  await wait(1200);

  await click(page.getByRole("link", { name: "Create Status Page" }).first());
  await page.waitForURL("**/status-pages/create");
  await wait(800);

  await type(page.getByPlaceholder("My Status Page"), "Acme Status");
  await wait(600);
  await type(
    page.getByLabel("Description"),
    "Live status of the Acme API and dashboard.",
  );
  await wait(600);

  await click(page.getByRole("button", { name: "Submit" }));
  await page.waitForURL(/\/status-pages\/\d+\/edit/);
  await page.waitForLoadState("networkidle");
  await wait(2500);
}
