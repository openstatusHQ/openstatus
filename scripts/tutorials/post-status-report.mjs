// How to post a status report: create it as investigating, then publish an
// identified and a resolved update from the report page.
import { cleanup, monitors, pages } from "./lib/fixtures.mjs";

export const meta = {
  order: 4,
  title: "Post a status report",
  subtitle: "Keep customers in the loop, from first alert to fix.",
  outroTitle: "Everyone knows what happened.",
  outroSubtitle: "Next: schedule maintenance before your next big change.",
};

const TITLE = "Checkout errors for EU customers";

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
  sheet,
  select,
}) {
  const id = pages.main;
  await sql(cleanup.statusReport({ title: TITLE, pageId: id }));
  await warm([`/status-pages/${id}/status-reports/1`]);

  await start(
    `/status-pages/${id}/status-reports`,
    "Something is wrong: open a report",
  );
  const report = await sheet("Create Status Report", "Status Report");
  step("Say what customers see");
  await report.fill("Title", TITLE);
  await report.fill(
    "Message",
    "EU payments are failing at checkout. Investigating.",
  );
  step("Mark the affected component");
  await report.check([monitors.api]);
  await report.submit(null);

  await click(page.getByRole("link", { name: TITLE }));
  await page.waitForURL(/\/status-reports\/\d+$/);
  await settle();

  step("Post updates as you learn more");
  const composer = page.getByRole("textbox", { name: /What changed/ });
  const publish = page.getByRole("button", { name: "Publish update" });
  await type(
    composer,
    "Cause found: an expired certificate on the EU gateway.",
  );
  await click(publish);
  await expect("Update published");
  // Let this toast go, so the next check cannot pass on it.
  await page
    .getByText("Update published", { exact: true })
    .waitFor({ state: "detached" });

  step("Resolve it when it is fixed");
  await select("Status", /resolved/i);
  await type(composer, "Certificate renewed, payments work again.");
  await click(publish);
  await expect("Update published");
}
