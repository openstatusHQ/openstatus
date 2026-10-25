// An incident run from Slack: declared with one command, worked in its own
// channel, pinned messages on the timeline, status from the pinned card, and
// the postmortem drafted and approved — the openstatus app's real messages.
import { cleanup } from "../../tutorials/lib/fixtures.mjs";

export const meta = {
  order: 1,
  label: "Slack",
  thumbEyebrow: "Slack · Incidents",
  title: "Run incidents from Slack",
  subtitle: "Declare, respond and close without leaving the channel.",
  outroTitle: "One timeline for Slack, the dashboard and the API.",
  outroSubtitle: "Next: review every incident in openstatus.",
};

export const team = { id: "T_ACME", name: "Acme", domain: "acme" };

// The first person is the one watching: their messages are typed out. userId
// is their seeded openstatus user.
export const people = [
  {
    id: "U_MAX",
    name: "max",
    realName: "Maximilian Kaske",
    email: "max@openstatus.dev",
    userId: 2,
  },
  {
    id: "U_THIBAULT",
    name: "thibault",
    realName: "Thibault Le Ouay Ducasse",
    email: "thibault@openstatus.dev",
    userId: 3,
  },
];

export const channels = [
  { id: "C_ENGINEERING", name: "engineering" },
  { id: "C_GENERAL", name: "general" },
  { id: "C_ONCALL", name: "on-call" },
  { id: "C_RELEASES", name: "releases" },
];

// What the model says when asked: a status-report draft, and the postmortem.
export const model = {
  draft: {
    pageId: 1,
    componentIds: [],
    impact: "partial_outage",
    message:
      "Checkout requests for customers in Europe are timing out. We are investigating.",
    startedAt: null,
    startedAtSource: null,
  },
  text: `## Summary
The checkout API in **eu-central** timed out for 35 minutes, until the export job was paused. A batch export job held every connection in the primary database pool, so checkout requests in fra and ams waited until they timed out.

## Impact
- 23% of checkout requests in eu-central failed between 10:02 and 10:37 UTC
- p99 latency rose from 180ms to over 30s
- Other regions were not affected

## Timeline
- 10:02 UTC - Monitors in fra and ams start failing
- 10:06 UTC - Incident declared from Slack
- 10:20 UTC - Root cause found: export job holding 100/100 connections
- 10:37 UTC - Mitigated: export job paused
- 11:04 UTC - Resolved: export job moved to the read replica

## Root cause
The nightly export job was rescheduled to 09:58 UTC, inside peak traffic. It opens one connection per tenant and holds it for the whole run, which exhausted the shared pool.

## What went well
- Regional monitors pinpointed eu-central within two minutes
- The status page was updated before the first customer ticket

## What went wrong
- The export job shared the pool with live traffic

## Action items
- [x] Run batch jobs against the read replica
- [ ] Alert when the pool is above 80% for 2 minutes`,
};

export const clock = "10:05";

const TITLE = "Checkout API timeouts in eu-central";

export default async function ({
  sql,
  step,
  say,
  command,
  click,
  submit,
  react,
  open,
  pause,
  clock,
  createdChannel,
  thumbnail,
}) {
  const [max, thibault] = people;
  await sql(cleanup.incident({ title: TITLE }));

  step("Something is wrong");
  await say(
    thibault,
    "Checkout is timing out for EU customers, seeing it in the monitors too 😬",
  );
  await say(max, "Declaring.");

  clock("10:06");
  step("Declare it in one command");
  await command(`/openstatus incident declare ${TITLE} --sev critical`);
  await pause(800);
  step("Approve the card");
  await click("approve");
  await pause(1200);

  step("Every incident gets its own channel");
  await open(createdChannel());
  await pause(1600);

  clock("10:12");
  step("Work it in the channel");
  await say(
    max,
    "p99 in fra and ams jumped from 180ms to 30s+. Other regions look fine. Checking the db pool.",
  );
  clock("10:20");
  const pool = await say(
    thibault,
    "Pool is at 100/100 connections. A batch export job started at 09:58 is holding them open.",
  );
  step("Pin a message, it lands on the timeline");
  await react(max, pool, "pushpin");
  await pause(1000);
  thumbnail();

  clock("10:37");
  step("Update the status from the pinned card");
  await click("incident_card_update_status");
  await submit({
    status: "mitigated",
    note: "Timeouts stopped, p99 back to 210ms in fra and ams.",
  });
  await pause(1200);

  clock("11:04");
  await click("incident_card_update_status");
  await submit({
    status: "resolved",
    note: "Export job runs on the read replica now. No errors for 30 minutes.",
  });
  await pause(1200);

  clock("11:09");
  step("The agent drafts the postmortem");
  await command("/openstatus incident postmortem");
  await pause(1200);
  step("Approve it, the incident closes");
  await click("approve");
  await pause(1500);
}
