// Product update: an agent sets up a monitor and a status page through the
// MCP setup tools. Every id and value it reports came back from the server.
import { cleanup, workspace } from "../../tutorials/lib/fixtures.mjs";

export const meta = {
  format: "update",
  title: "MCP setup tools",
  tagline: "Your agent can now create monitors and status pages.",
  link: "changelog/scopes-per-resource",
};

export const title = "Monitoring for the Billing API";

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

const MONITOR = "Billing API";
const URL = "https://billing.acme.com/health";
const PAGE = { title: "Acme Billing", slug: "acme-billing" };

const reset = [
  {
    q: "delete from page_component where page_id in (select id from page where slug = ? and workspace_id = ?)",
    params: [PAGE.slug, workspace],
  },
  ...cleanup.page({ slug: PAGE.slug }),
  ...cleanup.monitor({ name: MONITOR }),
];

export default async function (rec) {
  await rec.sql(reset);
  try {
    await story(rec);
  } finally {
    await rec.sql(reset);
  }
}

async function story({ step, say, reply, tool, activity, pause, thumbnail }) {
  step("Ask for the whole setup");
  await say(`Monitor ${URL} and put it on a new status page.`);

  step("Every write waits for your OK");
  let created, page, component;
  await activity("Created a monitor and a status page", async () => {
    created = await tool(
      "create_monitor",
      { name: MONITOR, url: URL, jobType: "http" },
      { summary: (o) => `Monitor #${o.monitor.id} created` },
    );
    page = await tool("create_status_page", PAGE, {
      summary: (o) => `${o.slug}.openstatus.dev created`,
    });
    component = await tool(
      "add_page_component",
      { pageId: page.id, monitorId: created.monitor.id },
      { summary: (o) => `${o.name} added to the page` },
    );
  });

  step("Monitored and public");
  const { monitor } = created;
  await reply(
    `**${monitor.name}** is checked every ${monitor.periodicity} from ${monitor.regions.length} regions, and **${page.title}** is live at \`${page.slug}.openstatus.dev\` with ${component.name} as its first component.`,
  );
  thumbnail();
  await pause(600);
}
