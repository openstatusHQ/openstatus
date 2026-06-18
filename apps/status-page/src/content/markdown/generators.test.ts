import { describe, expect, test } from "bun:test";

import { statusLabel, withPoweredBy } from "./helpers";
import {
  type MaintenanceDetail,
  type MonitorDetail,
  type OverviewPage,
  type ReportDetail,
  type UptimeComponent,
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
      createdAt: new Date("2026-06-18T10:00:00.000Z"),
      statusReportsToPageComponents: [{ pageComponent: { name: "API" } }],
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
      createdAt: new Date("2026-05-01T10:00:00.000Z"),
      statusReportsToPageComponents: [],
      statusReportUpdates: [
        {
          status: "resolved",
          message: "Fixed.",
          date: new Date("2026-05-02T10:00:00.000Z"),
        },
        {
          status: "investigating",
          message: "Down.",
          date: new Date("2026-05-01T10:00:00.000Z"),
        },
      ],
    },
  ],
  maintenances: [
    {
      id: 5,
      title: "DB upgrade",
      message: "Brief downtime.",
      from: new Date("2026-06-20T00:00:00.000Z"),
      to: new Date("2026-06-20T01:00:00.000Z"),
    },
  ],
  monitors: [{ id: 9, name: "API monitor", status: "success" }],
} as unknown as OverviewPage;

const components = [
  {
    name: "laser pointer tracker",
    uptime: "97.8%",
    data: [
      { bar: [{ status: "success", height: 100 }] },
      { bar: [{ status: "error", height: 100 }] },
      { bar: [{ status: "info", height: 100 }] },
    ],
  },
] as unknown as UptimeComponent[];

describe("generateOverview", () => {
  const md = generateOverview(overview, components, BASE);

  test("frontmatter + no generated-at", () => {
    expect(md).toContain('title: "Acme Status"');
    expect(md).toContain(`canonical: "${BASE}"`);
    expect(md).not.toContain("generated-at");
  });

  test("overall status line with emoji", () => {
    expect(md).toContain("🟧 **Degraded**");
  });

  test("active incident (resolved excluded)", () => {
    expect(md).toContain("**API latency**");
    expect(md).toContain("Looking into it.");
    expect(md).not.toContain("Old outage");
  });

  test("per-component emoji uptime bar", () => {
    expect(md).toContain("**laser pointer tracker** — 97.8%");
    expect(md).toContain("`3d ago → today`");
    expect(md).toContain("🟩🟥🟦");
  });

  test("showUptime=false renders current status instead of percentage", () => {
    const off = generateOverview(overview, components, BASE, false);
    // last fixture day is "info" → Maintenance; percentage must not appear
    expect(off).toContain("**laser pointer tracker** — Maintenance");
    expect(off).not.toContain("97.8%");
  });

  test("adaptive legend lists only present statuses, in severity order", () => {
    // fixture days are success, error, info → no degraded/no-data entries
    expect(md).toContain("Legend: 🟩 Operational · 🟥 Outage · 🟦 Maintenance");
    expect(md).not.toContain("🟧 Degraded");
    expect(md).not.toContain("⬜");
  });
});

describe("generateOverview empty components", () => {
  const empty = {
    title: "Empty",
    description: "",
    status: "success",
    statusReports: [],
    maintenances: [],
    monitors: [],
  } as unknown as OverviewPage;
  const md = generateOverview(empty, [], BASE);

  test("no components copy + operational", () => {
    expect(md).toContain("🟩 **Operational**");
    expect(md).toContain("No components.");
  });
});

describe("generateMonitorsList", () => {
  test("monitor row with status emoji + .md link", () => {
    const md = generateMonitorsList(overview, BASE);
    expect(md).toContain(
      `| 🟩 API monitor | Operational | ${BASE}/monitors/9.md |`,
    );
  });
});

describe("generateEventsList", () => {
  const md = generateEventsList(overview, BASE);

  test("lifecycle heading with from→to emoji", () => {
    expect(md).toContain("### 🟥→🟩 Old outage");
    expect(md).toContain("### 🟥→🟥 API latency");
  });

  test("affects + emoji update bullets", () => {
    expect(md).toContain("affects: API");
    expect(md).toContain("- 🟥 **Investigating** —");
    expect(md).toContain("- 🟩 **Resolved** —");
  });

  test("maintenance section", () => {
    expect(md).toContain("## Maintenance");
    expect(md).toContain("### 🟦 DB upgrade");
  });
});

describe("withPoweredBy", () => {
  test("appends attribution footer when not white-labeled", () => {
    const out = withPoweredBy("# Title\n", false);
    expect(out).toContain(
      "_Powered by [openstatus.dev](https://openstatus.dev)_",
    );
  });

  test("omits footer when white-labeled", () => {
    expect(withPoweredBy("# Title\n", true)).toBe("# Title\n");
  });
});

describe("statusLabel mapping", () => {
  test("component + report statuses", () => {
    expect(statusLabel("success")).toBe("Operational");
    expect(statusLabel("error")).toBe("Outage");
    expect(statusLabel("investigating")).toBe("Investigating");
    expect(statusLabel("resolved")).toBe("Resolved");
  });
});

describe("generateReport", () => {
  const report = {
    id: 1,
    title: "API latency",
    status: "monitoring",
    createdAt: new Date("2026-06-18T10:00:00.000Z"),
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

  test("lifecycle heading, affects, timeline", () => {
    expect(md).toContain("# 🟥→🟥 API latency");
    expect(md).toContain("affects: API");
    expect(md).toContain("### 🟥 Monitoring — Jun 18, 12:00 PM");
    expect(md).toContain("Recovering.");
    expect(md).toContain("### 🟥 Investigating — Jun 18, 10:00 AM");
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

  test("emoji heading, window, components", () => {
    expect(md).toContain("# 🟦 DB upgrade");
    expect(md).toContain(
      "**Window:** Jun 20, 12:00 AM → Jun 20, 1:00 AM · 1 hour",
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
            timestamp: 1_717_372_800_000,
            p50Latency: 100,
            p75Latency: 200,
            p95Latency: 300,
            p99Latency: 400,
          },
          {
            timestamp: 1_717_459_200_000,
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

  test("KPI table", () => {
    expect(md).toContain("| Global latency (p75) | 200ms – 300ms |");
    expect(md).toContain("| Region latency | 2 regions · fastest: iad |");
    expect(md).toContain("| Uptime (last 7 days) | 97.50% · 200 checks |");
  });

  test("sparkline section", () => {
    expect(md).toContain("## Global latency · p75 · last 7 days");
    expect(md).toContain("200ms – 300ms ·");
  });

  test("percentile table", () => {
    expect(md).toContain("| p50 | 150ms |");
    expect(md).toContain("| p99 | 450ms |");
  });

  test("per-region p75, slowest first", () => {
    expect(md).toContain("| ams | 300ms |");
    expect(md).toContain("| iad | 100ms |");
    expect(md.indexOf("| ams |")).toBeLessThan(md.indexOf("| iad |"));
  });

  test("no generated-at", () => {
    expect(md).not.toContain("generated-at");
  });
});
