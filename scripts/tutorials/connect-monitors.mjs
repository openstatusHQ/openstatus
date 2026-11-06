// How to show monitors on a status page: Components tab → add monitors → save.
// Starts on Settings: the Status Reports tab shows the page badge, which
// cannot load for the seeded page's made-up custom domain.
import { cleanup, monitors, pages } from "./lib/fixtures.mjs";

export const meta = {
  order: 3,
  label: "Connect",
  title: "Show your monitors",
  subtitle: "Turn uptime checks into a page your users can read.",
  outroTitle: "Your page shows live status.",
  outroSubtitle: "Next: post a status report when something breaks.",
};

export default async function ({
  page,
  sql,
  warm,
  start,
  step,
  click,
  settle,
  expect,
  tab,
  multiSelect,
}) {
  const id = pages.enterprise;
  await sql(cleanup.pageComponents({ pageId: id }));
  await warm([`/status-pages/${id}/components`]);

  await start(`/status-pages/${id}/edit`, "Open the status page");
  await tab("Components");
  await page.waitForURL(`**/status-pages/${id}/components`);
  await settle();

  step("Add your monitors as components");
  await multiSelect("Add Component", "Add Monitor Component", [
    monitors.api,
    monitors.website,
    monitors.search,
  ]);

  step("Save to show them on the page");
  await click(page.getByRole("button", { name: "Submit" }).first());
  await expect("Saved");
}
