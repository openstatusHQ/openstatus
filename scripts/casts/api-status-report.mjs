// Keep a status page current from any script: create a status report, post
// updates, and read it back, with curl against the REST API.
import { cleanup, pages } from "../tutorials/lib/fixtures.mjs";

export const meta = {
  order: 2,
  label: "API",
  thumbEyebrow: "API · Status reports",
  title: "Automate your status page",
  subtitle: "Post and resolve status reports from any script or pipeline.",
  outroTitle: "Your pipeline keeps customers posted.",
  outroSubtitle: "Next: the same from the CLI, or straight from Slack.",
};

const TITLE = "Checkout errors for EU customers";
const API = "https://api.openstatus.dev/v1";

export default async function ({ sql, step, run, pause, api }) {
  await sql(cleanup.statusReport({ title: TITLE, pageId: pages.main }));
  // Shown against api.openstatus.dev, run against the local API.
  const local = (lines) => lines.join("\n").replaceAll(API, `${api}/v1`);
  const post = (path, body) => {
    const lines = [
      `curl -s ${API}/${path} \\`,
      `  -H "x-openstatus-key: $OPENSTATUS_API_KEY" \\`,
      `  -H "content-type: application/json" \\`,
      `  -d '{`,
      ...body.map((l, i) => `    ${l}${i < body.length - 1 ? "," : ""}`),
      `  }' | jq`,
    ];
    return run(lines, { paste: true, exec: local(lines) });
  };

  step("Open a status report");
  const created = await post("status_report", [
    `"title": "${TITLE}"`,
    `"status": "investigating"`,
    `"message": "EU payments fail at checkout. We are investigating."`,
    `"pageId": ${pages.main}`,
  ]);
  const id = JSON.parse(created).id;
  await pause(1600);

  step("Post updates as you learn more");
  await post("status_report_update", [
    `"statusReportId": ${id}`,
    `"status": "identified"`,
    `"message": "An expired certificate on the EU gateway. Renewing it."`,
  ]);
  await pause(1400);

  step("Resolve it from the same pipeline");
  await post("status_report_update", [
    `"statusReportId": ${id}`,
    `"status": "resolved"`,
    `"message": "Certificate renewed, payments work again."`,
  ]);
  await pause(1400);

  step("Read it back");
  const get = [
    `curl -s ${API}/status_report/${id} \\`,
    `  -H "x-openstatus-key: $OPENSTATUS_API_KEY" | jq '{title, status, statusReportUpdateIds}'`,
  ];
  await run(get, { exec: local(get) });
  await pause(1800);
}
