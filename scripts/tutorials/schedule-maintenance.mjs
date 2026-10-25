// How to schedule a maintenance: pick a future window, affected components,
// and a message for subscribers.
import { pickableDay } from "./lib/dates.mjs";
import { cleanup, monitors, pages } from "./lib/fixtures.mjs";

export const meta = {
  order: 5,
  title: "Schedule maintenance",
  subtitle: "Warn customers before planned downtime, not after.",
  outroTitle: "Your users are warned.",
  outroSubtitle: "Next: set up alerts so you hear about issues first.",
};

const TITLE = "Database upgrade";

export default async function ({
  sql,
  warm,
  start,
  step,
  sheet,
  pickDateTime,
}) {
  const id = pages.main;
  await sql(cleanup.maintenance({ title: TITLE, pageId: id }));
  await warm([`/status-pages/${id}/maintenances`]);

  await start(`/status-pages/${id}/maintenances`, "Plan ahead in Maintenances");
  const maintenance = await sheet("Create Maintenance", "Maintenance");
  await maintenance.fill("Title", TITLE);

  step("Pick the window");
  const day = pickableDay();
  await pickDateTime(
    maintenance.locator.getByRole("button", { name: "Start Date" }),
    day,
    "22:00",
  );
  await pickDateTime(
    maintenance.locator.getByRole("button", { name: "End Date" }),
    day,
    "23:30",
  );

  step("Explain the impact");
  await maintenance.fill(
    "Message",
    "We are upgrading our database. The API may be read-only for a few minutes.",
  );
  await maintenance.check([monitors.api]);

  step("Schedule it");
  await maintenance.submit();
}
