import { describe, expect, test } from "bun:test";

import { statusLabel, withPoweredBy } from "./helpers";
import {
  type MaintenanceDetail,
  type MonitorDetail,
  type OverviewPage,
  type ReportDetail,
  generateEventsList,
  generateMaintenance,
  generateMonitor,
  generateMonitorsList,
  generateOverview,
  generateReport,
} from "./index";

const BASE = "https://acme.openstatus.dev";

// Fixtures are partial — generators only read the fields asserted below.
const overview = {
  title: "Acme Status",
  description: "Acme service status",
  status: "degraded",
  statusReports: [
    {
      id: 1,
      title: "API latency",
      status: "investigating",
      statusReportUpdates: [
        {
          status: "investigating",
          message: "Looking into it.",
          date: new Date("2026-06-18T10:00:00.000Z"),
        },
      ],
    },
    {
      id: 2,
      title: "Old outage",
      status: "resolved",
      statusReportUpdates: [],
    },
  ],
  maintenances: [
    {
      id: 5,
      title: "DB upgrade",
      from: new Date("2026-06-20T00:00:00.000Z"),
      to: new Date("2099-06-20T01:00:00.000Z"),
    },
  ],
  trackers: [
    {
      type: "component",
      component: { name: "API", status: "error" },
      order: 0,
    },
    {
      type: "group",
      groupName: "Web",
      status: "success",
      components: [{ name: "Landing", status: "success" }],
      order: 1,
    },
  ],
  lastEvents: [
    {
      name: "Resolved incident",
      type: "report",
      status: "success",
      from: new Date("2026-06-15T00:00:00.000Z"),
    },
  ],
  monitors: [{ id: 9, name: "API monitor", status: "success" }],
} as unknown as OverviewPage;

describe("generateOverview", () => {
  const md = generateOverview(overview, BASE);

  test("frontmatter keys present, no generated-at", () => {
    expect(md).toContain('title: "Acme Status"');
    expect(md).toContain('description: "Acme service status"');
    expect(md).toContain(`canonical: "${BASE}"`);
    expect(md).not.toContain("generated-at");
  });

  test("overall status label", () => {
    expect(md).toContain("**Overall status:** Degraded");
  });

  test("active incident rendered, resolved one excluded", () => {
    expect(md).toContain("### API latency");
    expect(md).toContain("Looking into it.");
    expect(md).not.toContain("Old outage");
  });

  test("detail link is a .md url", () => {
    expect(md).toContain(`${BASE}/events/report/1.md`);
    expect(md).toContain(`${BASE}/events/maintenance/5.md`);
  });

  test("component table rows", () => {
    expect(md).toContain("| API | Outage |");
    expect(md).toContain("| Web (group) | Operational |");
    expect(md).toContain("| — Landing | Operational |");
  });
});

describe("generateOverview empty states", () => {
  const empty = {
    title: "Empty",
    description: "d",
    status: "success",
    statusReports: [],
    maintenances: [],
    trackers: [],
    lastEvents: [],
    monitors: [],
  } as unknown as OverviewPage;
  const md = generateOverview(empty, BASE);

  test("no active incidents copy", () => {
    expect(md).toContain("No active incidents.");
    expect(md).toContain("No active or upcoming maintenance.");
    expect(md).toContain("No recent events.");
  });
});

describe("generateMonitorsList", () => {
  test("monitor row with .md link", () => {
    const md = generateMonitorsList(overview, BASE);
    expect(md).toContain(
      "| API monitor | Operational | " + `${BASE}/monitors/9.md`,
    );
  });
});

describe("generateEventsList", () => {
  test("report and maintenance tables", () => {
    const md = generateEventsList(overview, BASE);
    expect(md).toContain("## Status reports");
    expect(md).toContain("API latency");
    expect(md).toContain("## Maintenance");
    expect(md).toContain("DB upgrade");
  });
});

describe("withPoweredBy", () => {
  test("appends attribution footer when not white-labeled", () => {
    const out = withPoweredBy("# Title\n", false);
    expect(out).toContain(
      "_Powered by [openstatus.dev](https://openstatus.dev)_",
    );
    expect(out).toContain("# Title");
  });

  test("omits footer when white-labeled", () => {
    const out = withPoweredBy("# Title\n", true);
    expect(out).toBe("# Title\n");
    expect(out).not.toContain("openstatus.dev");
  });
});

describe("statusLabel mapping", () => {
  test("component statuses", () => {
    expect(statusLabel("success")).toBe("Operational");
    expect(statusLabel("degraded")).toBe("Degraded");
    expect(statusLabel("error")).toBe("Outage");
    expect(statusLabel("info")).toBe("Maintenance");
  });

  test("report statuses", () => {
    expect(statusLabel("investigating")).toBe("Investigating");
    expect(statusLabel("identified")).toBe("Identified");
    expect(statusLabel("monitoring")).toBe("Monitoring");
    expect(statusLabel("resolved")).toBe("Resolved");
  });
});

describe("generateReport", () => {
  const report = {
    id: 1,
    title: "API latency",
    status: "monitoring",
    statusReportsToPageComponents: [{ pageComponent: { name: "API" } }],
    statusReportUpdates: [
      {
        status: "monitoring",
        message: "Recovering.",
        date: new Date("2026-06-18T12:00:00.000Z"),
      },
      {
        status: "investigating",
        message: "Started.",
        date: new Date("2026-06-18T10:00:00.000Z"),
      },
    ],
  } as unknown as ReportDetail;
  const md = generateReport(report, BASE);

  test("title, status, affected components, timeline", () => {
    expect(md).toContain("# API latency");
    expect(md).toContain("**Status:** Monitoring");
    expect(md).toContain("**Affected components:** API");
    expect(md).toContain("### Monitoring — 2026-06-18T12:00:00.000Z");
    expect(md).toContain("Recovering.");
    expect(md).toContain("Started.");
  });
});

describe("generateMaintenance", () => {
  const maintenance = {
    id: 5,
    title: "DB upgrade",
    message: "Brief downtime.",
    from: new Date("2026-06-20T00:00:00.000Z"),
    to: new Date("2026-06-20T01:00:00.000Z"),
    maintenancesToPageComponents: [{ pageComponent: { name: "Database" } }],
  } as unknown as MaintenanceDetail;
  const md = generateMaintenance(maintenance, BASE);

  test("window, components, message", () => {
    expect(md).toContain(
      "**Window:** 2026-06-20T00:00:00.000Z → 2026-06-20T01:00:00.000Z",
    );
    expect(md).toContain("**Affected components:** Database");
    expect(md).toContain("Brief downtime.");
  });
});

describe("generateMonitor", () => {
  const monitor = {
    id: 9,
    name: "API monitor",
    description: "Main API",
    url: "https://api.acme.com",
    data: {
      latency: {
        data: [
          {
            p50Latency: 100,
            p75Latency: 200,
            p95Latency: 300,
            p99Latency: 400,
          },
          {
            p50Latency: 200,
            p75Latency: 300,
            p95Latency: 400,
            p99Latency: 500,
          },
        ],
      },
      regions: {
        data: [
          { region: "ams", p75Latency: 200 },
          { region: "ams", p75Latency: 400 },
          { region: "iad", p75Latency: 100 },
        ],
      },
      uptime: {
        data: [
          { interval: new Date(), success: 90, degraded: 5, error: 5 },
          { interval: new Date(), success: 100, degraded: 0, error: 0 },
        ],
      },
    },
  } as unknown as MonitorDetail;
  const md = generateMonitor(monitor, BASE);

  test("7-day window label + aggregates", () => {
    expect(md).toContain("**Uptime (last 7 days):** 97.50% (200 checks)");
    expect(md).toContain("## Latency (last 7 days)");
    expect(md).toContain("| p50 | 150ms |");
    expect(md).toContain("| p75 | 250ms |");
    expect(md).toContain("| p95 | 350ms |");
    expect(md).toContain("| p99 | 450ms |");
  });

  test("per-region p75 sorted slowest first", () => {
    expect(md).toContain("## Latency by region — p75 (last 7 days)");
    expect(md).toContain("| ams | 300ms |");
    expect(md).toContain("| iad | 100ms |");
    expect(md.indexOf("| ams |")).toBeLessThan(md.indexOf("| iad |"));
  });

  test("no generated-at", () => {
    expect(md).not.toContain("generated-at");
  });
});
