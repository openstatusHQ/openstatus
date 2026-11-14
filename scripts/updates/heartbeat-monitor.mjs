// Product update: create a heartbeat monitor for a cron job, take its ping
// URL, and see the monitor turn on time when the job pings.
//
// Heartbeats are behind an allowlist and the page reads its pings from
// Tinybird, so the dashboard needs more than the seeded stack gives it:
//   HEARTBEAT_WORKSPACE_IDS=1 (the seeded workspace),
//   HEARTBEAT_PING_BASE_URL=https://api.openstatus.dev (what the URL reads as),
//   TINYBIRD_URL=http://127.0.0.1:3098 TINYBIRD_NOOP=false TINY_BIRD_API_KEY=fake
import { cleanup } from "../tutorials/lib/fixtures.mjs";

export const meta = {
  format: "update",
  title: "Heartbeat monitors",
  tagline: "Know when a cron job goes quiet.",
  link: "docs/reference/heartbeat-monitor",
  requires: ["api"],
};

const NAME = "Database backup";
const PINGS = "endpoint__heartbeat_status_45d__v0";

// The recorder answers the dashboard's Tinybird pipes with these rows; the
// day's ping joins them when the job runs.
export const tinybird = { [PINGS]: [] };

export default async function ({
  page,
  sql,
  api,
  warm,
  goto,
  start,
  step,
  click,
  type,
  look,
  expect,
  settle,
}) {
  await sql(cleanup.monitor({ name: NAME }));
  await warm(["/monitors/create", "/monitors/1/edit", "/monitors/1/overview"]);

  await goto("/monitors/create");
  const heartbeat = page.locator("label", { hasText: /^Heartbeat$/ });
  if (!(await heartbeat.isVisible()))
    throw new Error(
      "no Heartbeat type on the form: start the dashboard with HEARTBEAT_WORKSPACE_IDS=1",
    );

  await start(undefined, "Monitor a cron job");
  await type(page.getByRole("textbox", { name: "Name" }), NAME);
  await click(heartbeat);
  await click(page.getByRole("button", { name: "Submit" }));
  await page.waitForURL(/\/monitors\/\d+\/edit/);
  await expect("Saved");
  const id = page.url().match(/\/monitors\/(\d+)\//)[1];

  await click(
    page
      .getByRole("link", { name: "Overview", exact: true })
      .and(page.locator(`[href="/monitors/${id}/overview"]`)),
  );
  await page.waitForURL(/\/overview/);
  await settle();
  step("Your job pings this URL");
  await look(
    page.getByText(/^https:\/\/api\.openstatus\.dev\/heartbeat\//),
    1600,
  );

  // The job runs: the request its last line would send, to the local API.
  const [{ rows }] = await sql([
    { q: "select heartbeat_token from monitor where id = ?", params: [id] },
  ]);
  tinybird[PINGS].push({
    day: `${new Date().toISOString().slice(0, 10)} 00:00:00`,
    count: 1,
    ok: 1,
    degraded: 0,
    error: 0,
    monitorId: id,
  });
  const ping = await fetch(`${api}/heartbeat/${rows[0][0]}`, {
    method: "POST",
    body: "backup done",
  });
  if (!ping.ok) throw new Error(`ping answered ${ping.status} at ${api}`);

  // The page polls while it waits; the legend only shows with the pings chart.
  await expect("On time");
  await expect("Success");
  step("Every run checks in");
  const card = (variant, title) =>
    page.locator(`div[data-variant=${variant}]`).filter({ hasText: title });
  await look(card("success", "STATUS"), 1600);

  step("Miss one and you get the alert");
  await look(card("default", "NEXT PING"), 1600);
}
