// An agent finds a regional slowdown, declares an incident and posts to the
// status page, through the real MCP tools. Its numbers come from their results.
import { cleanup, pages, workspace } from "../../tutorials/lib/fixtures.mjs";

export const meta = {
  order: 1,
  label: "MCP",
  thumbEyebrow: "MCP · Incident response",
  title: "Respond to incidents from your agent",
  subtitle: "Ask what's wrong, then act on it, with approval on every write.",
  outroTitle: "Your agent knows what your monitors know.",
  outroSubtitle: "Connect the openstatus MCP server to get started.",
};

export const title = "Slow API in Europe";

export const client = {
  user: "Alex Rivera",
  plan: "Acme",
  model: "Sonnet 5.5",
  recents: [
    "On-call rota for December",
    "Postgres connection pooling",
    "Release notes for 2.4",
    "Reply to enterprise customer",
  ],
};

// A monitor's fixtures: no checker runs here, so these stand in for its checks.
const MONITOR = 1;
const REGIONS = {
  ams: "degraded",
  fra: "degraded",
  iad: "active",
  sin: "active",
};

export const tinybird = {
  endpoint__http_metrics_1d__v1: [
    {
      p50Latency: 312,
      p75Latency: 640,
      p90Latency: 1980,
      p95Latency: 2840,
      p99Latency: 4120,
      count: 5760,
      success: 5348,
      degraded: 412,
      error: 0,
      lastTimestamp: Date.now() - 42_000,
    },
  ],
};

const INCIDENT = "API degraded in Europe";
const REPORT = "Slow API responses in Europe";

const reset = (regions) => [
  { q: "delete from monitor_status where monitor_id = ?", params: [MONITOR] },
  {
    q: "update monitor set regions = ? where id = ? and workspace_id = ?",
    params: [regions, MONITOR, workspace],
  },
];

export default async function (rec) {
  try {
    await story(rec);
  } finally {
    await rec.sql(reset("ams"));
  }
}

async function story({
  sql,
  step,
  say,
  reply,
  tool,
  activity,
  pause,
  thumbnail,
}) {
  await sql([
    ...cleanup.incident({ title: INCIDENT }),
    ...cleanup.statusReport({ title: REPORT, pageId: pages.main }),
    ...reset(Object.keys(REGIONS).join(",")),
    ...Object.entries(REGIONS).map(([region, status]) => ({
      q: "insert into monitor_status (monitor_id, region, status) values (?, ?, ?)",
      params: [MONITOR, region, status],
    })),
  ]);

  step("Ask in plain language");
  await say("Customers say the API is slow in Europe. What's going on?");

  step("The agent reads your monitors");
  let monitors, api, status, summary;
  await activity(
    "Checked the API's health across regions",
    async () => {
      monitors = await tool(
        "list_monitors",
        {},
        {
          summary: (o) => `${o.pagination.totalSize} monitors`,
        },
      );
      api = monitors.items.find((m) => m.id === MONITOR);
      status = await tool(
        "get_monitor_status",
        { monitorId: api.id },
        {
          summary: (o) =>
            `${o.regions.filter((r) => r.status !== "active").length} of ${o.regions.length} regions degraded`,
        },
      );
      summary = await tool(
        "get_monitor_summary",
        { monitorId: api.id, timeRange: "1d" },
        {
          summary: (o) => `p95 ${o.p95.toLocaleString("en-US")} ms`,
        },
      );
    },
    { open: true },
  );

  const bad = status.regions.filter((r) => r.status !== "active");
  const good = status.regions.filter((r) => r.status === "active");
  const list = (regions) => regions.map((r) => `\`${r.region}\``).join(" and ");
  await reply(
    `**${api.name}** is degraded in ${list(bad)}, while ${list(good)} are healthy. Over the last 24 hours p95 is **${summary.p95.toLocaleString("en-US")} ms** against a p50 of ${summary.p50.toLocaleString("en-US")} ms, with ${summary.totalDegraded.toLocaleString("en-US")} degraded checks and no failures.`,
  );
  await pause(1200);

  step("Writes wait for your approval");
  await say("Declare an incident and post it on our status page.");
  let declared, statusPage, report;
  await activity(
    "Declared the incident and published a status report",
    async () => {
      declared = await tool(
        "declare_incident",
        {
          title: INCIDENT,
          severity: "major",
          summary: `p95 ${summary.p95.toLocaleString("en-US")} ms in ${bad.map((r) => r.region).join(", ")}.`,
        },
        { summary: (o) => `Incident #${o.id} declared` },
      );
      const statusPages = await tool(
        "list_status_pages",
        {},
        { summary: (o) => `${o.items.length} status pages` },
      );
      statusPage = statusPages.items.find((p) => p.id === pages.main);
      const components = await tool(
        "list_page_components",
        { pageId: statusPage.id },
        { summary: (o) => `${o.items.length} components` },
      );
      const component = components.items.find((c) => c.name === api.name);
      report = await tool(
        "create_status_report",
        {
          title: REPORT,
          status: "investigating",
          message:
            "API responses are slow for customers in Europe. We are investigating.",
          pageId: statusPage.id,
          pageComponentIds: [component.id],
          incidentId: declared.id,
          notify: false,
        },
        { summary: (o) => `Status report #${o.statusReport.id} published` },
      );
    },
  );

  step("Live on your status page");
  await reply(
    `Incident **#${declared.id}** is open, and report **#${report.statusReport.id}** is live on **${statusPage.title}**, linked to the incident.`,
  );
  thumbnail();
  await pause(800);
}
