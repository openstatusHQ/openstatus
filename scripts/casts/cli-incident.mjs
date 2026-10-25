// Run an incident from the terminal with the openstatus CLI: declare it, note
// what you find, mitigate, resolve, then read the timeline back.
export const meta = {
  order: 1,
  label: "CLI",
  thumbEyebrow: "CLI · Incidents",
  title: "Run an incident from your terminal",
  subtitle: "Declare, update and resolve without leaving the shell.",
  outroTitle: "One timeline, wherever you work.",
  outroSubtitle: "Next: the same incident from Slack and the dashboard.",
};

const TITLE = "Checkout API timeouts in eu-central";

export default async function ({ sql, step, run, pause }) {
  const ids = `select id from incident where title = ? and workspace_id = 1`;
  await sql([
    {
      q: `delete from incident_event where incident_id in (${ids})`,
      params: [TITLE],
    },
    {
      q: `delete from incident_postmortem where incident_id in (${ids})`,
      params: [TITLE],
    },
    { q: `delete from incident where id in (${ids})`, params: [TITLE] },
  ]);

  step("Declare it");
  const declared = await run(
    `openstatus inc declare --title "${TITLE}" --severity critical`,
  );
  const id = declared.match(/ID: (\d+)/)?.[1];
  if (!id) throw new Error(`no incident id in:\n${declared}`);
  await pause(1200);

  step("Note what you find");
  await run(
    `openstatus inc note ${id} --message "Pool at 100/100: an export job holds every connection."`,
  );
  await pause(900);

  step("Mitigate");
  await run(
    `openstatus inc mitigate ${id} --note "Export job paused, timeouts stopped."`,
  );
  await pause(900);

  step("Resolve");
  await run(
    `openstatus inc resolve ${id} --note "Export job now runs on the read replica."`,
  );
  await pause(900);

  step("Read the whole timeline");
  await run(`openstatus inc info ${id}`);
  await pause(1500);
}
