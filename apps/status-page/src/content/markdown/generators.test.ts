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
      statusReportsToPageComponents: [
        { pageComponentId: 100, pageComponent: { name: "API" } },
      ],
      statusReportUpdates: [
        {
          status: "investigating",
          message: "Looking into it.",
          date: new Date("2026-06-18T10:00:00.000Z"),
          statusReportUpdateToPageComponents: [
            { pageComponentId: 100, impact: "major_outage" },
          ],
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
      to: new Date("2099-06-20T01:00:00.000Z"),
      maintenancesToPageComponents: [{ pageComponent: { name: "Database" } }],
    },
  ],
  monitors: [{ id: 9, name: "API monitor", status: "success" }],
  homepageUrl: "https://acme.com",
  contactUrl: "mailto:status@acme.com",
} as unknown as OverviewPage;

const components = [
  {
    name: "laser pointer tracker",
    pageComponentId: 100,
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
    expect(md).toContain(`base_url: "${BASE}"`);
    expect(md).toContain(`canonical: "${BASE}"`);
    expect(md).not.toContain("generated-at");
  });

  test("frontmatter carries page homepage + contact urls", () => {
    expect(md).toContain('homepage_url: "https://acme.com"');
    expect(md).toContain('contact_url: "mailto:status@acme.com"');
  });

  test("peer nav links to monitors + events docs", () => {
    expect(md).toContain(
      `**Status** · [Monitors](/monitors.md) · [Events](/events.md)`,
    );
  });

  test("overall status line with emoji + timestamp", () => {
    expect(md).toContain("🟧 **Degraded** · ");
    expect(md).toMatch(/\(GMT\+0\)/);
  });

  test("active incident with affected components (resolved excluded)", () => {
    expect(md).toContain("**API latency**");
    expect(md).toContain("affects: API");
    expect(md).toContain("Looking into it.");
    expect(md).not.toContain("Old outage");
  });

  test("active & upcoming maintenance with affected components", () => {
    expect(md).toContain("## Active & upcoming maintenance");
    expect(md).toContain("🟦 **DB upgrade**");
    expect(md).toContain("affects: Database");
  });

  test("per-component emoji uptime bar", () => {
    expect(md).toContain("**laser pointer tracker** — 97.8%");
    expect(md).toContain("`3d ago → today`");
    expect(md).toContain("🟩🟥🟦");
  });

  test("per-component event links to affecting reports", () => {
    expect(md).toContain(`Events: [API latency](/events/report/1.md)`);
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
    expect(md).toContain(`| 🟩 API monitor | Operational | /monitors/9.md |`);
  });
});

describe("generateEventsList", () => {
  const md = generateEventsList(overview, BASE);

  test("report heading is a link, no emoji", () => {
    expect(md).toContain(`### [Old outage](/events/report/2.md)`);
    expect(md).toContain(`### [API latency](/events/report/1.md)`);
    expect(md).not.toContain("### 🟥");
  });

  test("affects includes per-component impact; bullets have no bold", () => {
    expect(md).toContain("affects: API (major outage)");
    expect(md).toContain("- 🟥 Investigating —");
    expect(md).toContain("- 🟩 Resolved —");
    expect(md).not.toContain("**Investigating**");
  });

  test("update bullet carries its own per-component impact, no body", () => {
    expect(md).toContain("· API (major outage)");
    expect(md).not.toContain("Looking into it.");
  });

  test("greppable event log: fenced, sortable stamp, ref, trailing emoji", () => {
    expect(md).toContain("## Event log");
    expect(md).toContain("```text");
    expect(md).toContain("# timestamp");
    expect(md).toMatch(
      /2026-06-18 10:00 {2}INVESTIGATING {2}report\/1 +🟥 API latency/,
    );
    expect(md).toMatch(
      /2026-05-02 10:00 {2}RESOLVED {2,}report\/2 +🟩 Old outage/,
    );
    // newest update sorts above older ones
    expect(md.indexOf("2026-06-18 10:00")).toBeLessThan(
      md.indexOf("2026-05-02 10:00"),
    );
  });

  test("maintenance heading is a link, no emoji", () => {
    expect(md).toContain("## Maintenance");
    expect(md).toContain(`### [DB upgrade](/events/maintenance/5.md)`);
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
    statusReportsToPageComponents: [
      { pageComponentId: 100, pageComponent: { name: "API" } },
    ],
    statusReportUpdates: [
      {
        status: "resolved",
        message: "All good.",
        date: new Date("2026-06-18T13:00:00.000Z"),
        statusReportUpdateToPageComponents: [
          { pageComponentId: 100, impact: "operational" },
        ],
      },
      {
        status: "monitoring",
        message: "Recovering.",
        date: new Date("2026-06-18T12:00:00.000Z"),
        statusReportUpdateToPageComponents: [
          { pageComponentId: 100, impact: "degraded_performance" },
        ],
      },
      {
        status: "investigating",
        message: "Started.",
        date: new Date("2026-06-18T10:00:00.000Z"),
        statusReportUpdateToPageComponents: [
          { pageComponentId: 100, impact: "major_outage" },
        ],
      },
    ],
  } as unknown as ReportDetail;
  const md = generateReport(report, BASE);

  test("breadcrumb roots back to Status › Events", () => {
    expect(md).toContain(`[Status](/.md) › [Events](/events.md) › API latency`);
  });

  test("lifecycle heading, affects, timeline", () => {
    expect(md).toContain("# API latency");
    expect(md).toContain("affects: API");
    expect(md).toContain("### 🟥 Monitoring — Jun 18, 12:00 PM");
    expect(md).toContain("Recovering.");
    expect(md).toContain("### 🟥 Investigating — Jun 18, 10:00 AM");
  });

  test("each update lists its own impact, operational shown explicitly", () => {
    expect(md).toContain("affects: API (degraded performance)");
    expect(md).toContain("affects: API (major outage)");
    expect(md).toContain("affects: API (operational)");
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

  test("heading, window, components", () => {
    expect(md).toContain("# DB upgrade");
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

  test("percentile table", () => {
    expect(md).toContain("| p50 | 150ms |");
    expect(md).toContain("| p99 | 450ms |");
  });

  test("breadcrumb roots back to Status › Monitors", () => {
    expect(md).toContain(
      `[Status](/.md) › [Monitors](/monitors.md) › API monitor`,
    );
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
