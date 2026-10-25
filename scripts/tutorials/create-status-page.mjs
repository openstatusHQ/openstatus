// How to create a status page: list → create form → edit page.
import { cleanup, pages } from "./lib/fixtures.mjs";

export const meta = {
  order: 1,
  label: "Launch",
  title: "Launch a status page",
  subtitle: "One place for your customers to check what is up.",
  outroTitle: "Your status page is live.",
  outroSubtitle:
    "Next: connect monitors, add your domain, and invite subscribers.",
};

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
}) {
  await sql(cleanup.page({ slug: "acme-payments" }));
  await warm(["/status-pages/create", `/status-pages/${pages.main}/edit`]);

  await start("/status-pages", "Open Status Pages");
  await click(page.getByRole("link", { name: "Create Status Page" }).first());
  await page.waitForURL("**/status-pages/create");
  await settle();

  step("Give it a name, the slug follows");
  await type(page.getByPlaceholder("My Status Page"), "Acme Payments");
  step("Tell visitors what it covers");
  await type(
    page.getByLabel("Description"),
    "Live status of Acme checkout and payouts.",
  );

  step("Create it");
  await click(page.getByRole("button", { name: "Submit" }));
  await page.waitForURL(/\/status-pages\/\d+\/edit/);
  await settle();
  await expect("Saved");
}
