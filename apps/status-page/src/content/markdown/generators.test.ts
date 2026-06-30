import { describe, expect, test } from "bun:test";

import {
  escapeCell,
  escapeLinkLabel,
  eventLog,
  frontmatter,
  navLine,
  statusLabel,
  withPoweredBy,
} from "./helpers";
import {
  generateEventsList,
  generateMaintenance,
  generateMonitor,
  generateMonitorsList,
  generateOverview,
  generateReport,
  type MaintenanceDetail,
  type MonitorDetail,
  type OverviewPage,
  type ReportDetail,
  type UptimeComponent,
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
  trackers: [],
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

  test("overall status line with glyph + timestamp", () => {
    expect(md).toContain("`~` **Degraded** · ");
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
    expect(md).toContain("= **DB upgrade**");
    expect(md).toContain("affects: Database");
  });

  test("per-component ascii uptime bar in a code span", () => {
    expect(md).toContain("**laser pointer tracker** — 97.8%");
    expect(md).toContain("`3d ago → today`");
    expect(md).toContain("`+x=`");
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

  test("legend lists every status in severity order", () => {
    expect(md).toContain(
      "Legend: `+` Operational · `~` Degraded · `x` Outage · `=` Maintenance · `.` No data",
    );
  });
});

describe("generateOverview machine-readable pointer", () => {
  test("public page points to json endpoints + llms.txt", () => {
    const pub = {
      ...overview,
      trackers: [],
      accessType: "public",
    } as unknown as OverviewPage;
    expect(generateOverview(pub, components, BASE)).toContain(
      "Machine-readable: [current.json](/api/status/current.json) · [summary.json](/api/status/summary.json) · [more](/llms.txt)",
    );
  });

  test("gated page omits the pointer", () => {
    const gated = {
      ...overview,
      trackers: [],
      accessType: "password",
    } as unknown as OverviewPage;
    expect(generateOverview(gated, components, BASE)).not.toContain(
      "Machine-readable:",
    );
  });
});

describe("generateOverview live frontmatter", () => {
  const page = {
    title: "Acme",
    description: "",
    status: "degraded",
    updatedAt: new Date("2026-06-18T14:03:00.000Z"),
    statusReports: [
      {
        id: 1,
        title: "x",
        status: "investigating",
        createdAt: new Date("2026-06-18T10:00:00.000Z"),
        statusReportsToPageComponents: [],
        statusReportUpdates: [],
      },
    ],
    maintenances: [],
    monitors: [],
    trackers: [
      {
        type: "component",
        component: { name: "API", status: "error" },
        order: 0,
      },
      {
        type: "component",
        component: { name: "Web", status: "success" },
        order: 1,
      },
      {
        type: "group",
        groupName: "g",
        components: [{ name: "DB", status: "success" }],
        status: "success",
        order: 2,
      },
    ],
  } as unknown as OverviewPage;
  const comps = [
    {
      name: "API",
      pageComponentId: 1,
      uptime: "99.0%",
      data: [{ bar: [{ status: "success", height: 100 }] }],
    },
  ] as unknown as UptimeComponent[];

  const count = (s: string, sub: string) => s.split(sub).length - 1;

  test("frontmatter carries live machine state", () => {
    const md = generateOverview(page, comps, BASE);
    expect(md).toContain('status: "degraded"');
    expect(md).toContain("active_reports: 1");
    expect(md).toContain("active_maintenance: 0");
    expect(md).toContain("components_operational: 2");
    expect(md).toContain("components_total: 3");
    expect(md).toContain('worst_component: "API"');
    // fetched_at is the generation time, minute-granular ISO; no misleading
    // page-mtime updated_at, no cryptic Statuspage indicator.
    expect(md).toMatch(/fetched_at: "\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z"/);
    expect(md).not.toContain("indicator:");
    expect(md).not.toContain("updated_at:");
  });

  test("always renders the ascii uptime bar + legend", () => {
    const md = generateOverview(page, comps, BASE);
    // The `+` bar is a code span (`` `+` ``); `(GMT+0)` has a bare `+`, so match
    // the wrapped form to isolate the bar.
    expect(count(md, "`+`")).toBeGreaterThan(0);
    expect(md).toContain("Legend:");
  });
});

describe("generateOverview component ordering + grouping", () => {
  const page = {
    title: "Acme",
    description: "",
    status: "success",
    statusReports: [],
    maintenances: [],
    monitors: [],
    trackers: [
      {
        type: "component",
        component: { id: 1, name: "API", status: "success" },
        order: 0,
      },
      {
        type: "component",
        component: { id: 2, name: "Web", status: "success" },
        order: 1,
      },
      {
        type: "group",
        groupName: "Databases",
        components: [
          { id: 3, name: "Primary DB", status: "success" },
          { id: 4, name: "Replica DB", status: "success" },
        ],
        status: "success",
        order: 2,
      },
    ],
  } as unknown as OverviewPage;

  // Uptime arrives in a different (DB-arbitrary) order than trackers.
  const day = { bar: [{ status: "success", height: 100 }] };
  const comps = [
    { name: "Replica DB", pageComponentId: 4, uptime: "99%", data: [day] },
    { name: "API", pageComponentId: 1, uptime: "100%", data: [day] },
    { name: "Primary DB", pageComponentId: 3, uptime: "98%", data: [day] },
    { name: "Web", pageComponentId: 2, uptime: "100%", data: [day] },
  ] as unknown as UptimeComponent[];

  const md = generateOverview(page, comps, BASE);

  test("renders components in tracker order, not uptime-array order", () => {
    const order = ["API", "Web", "Primary DB", "Replica DB"].map((n) =>
      md.indexOf(`**${n}**`),
    );
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  test("emits a heading for grouped components, not for ungrouped", () => {
    expect(md).toContain("### Databases");
    expect(md.indexOf("### Databases")).toBeLessThan(
      md.indexOf("**Primary DB**"),
    );
    expect(md).not.toContain("### API");
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
    trackers: [],
  } as unknown as OverviewPage;
  const md = generateOverview(empty, [], BASE);

  test("no components copy + operational", () => {
    expect(md).toContain("`+` **Operational**");
    expect(md).toContain("No components.");
  });
});

describe("generateMonitorsList", () => {
  test("monitor row with status glyph + .md link", () => {
    const md = generateMonitorsList(overview, BASE);
    expect(md).toContain(`| + API monitor | Operational | /monitors/9.md |`);
  });
});

describe("generateEventsList", () => {
  const md = generateEventsList(overview, BASE);

  test("report heading is a link, no glyph", () => {
    expect(md).toContain(`### [Old outage](/events/report/2.md)`);
    expect(md).toContain(`### [API latency](/events/report/1.md)`);
    expect(md).not.toContain("### x");
  });

  test("affects includes per-component impact; bullets have no bold", () => {
    expect(md).toContain("affects: API (major outage)");
    expect(md).toContain("- x Investigating —");
    expect(md).toContain("- + Resolved —");
    expect(md).not.toContain("**Investigating**");
  });

  test("update bullet carries its own per-component impact, no body", () => {
    expect(md).toContain("· API (major outage)");
    expect(md).not.toContain("Looking into it.");
  });

  test("greppable event log: fenced, sortable stamp, ref, trailing glyph", () => {
    expect(md).toContain("## Event log");
    expect(md).toContain("```text");
    expect(md).toContain("# timestamp");
    expect(md).toMatch(
      /2026-06-18 10:00 {2}INVESTIGATING {2}report\/1 +x API latency/,
    );
    expect(md).toMatch(
      /2026-05-02 10:00 {2}RESOLVED {2,}report\/2 +\+ Old outage/,
    );
    // newest update sorts above older ones
    expect(md.indexOf("2026-06-18 10:00")).toBeLessThan(
      md.indexOf("2026-05-02 10:00"),
    );
  });

  test("maintenance heading is a link, no glyph", () => {
    expect(md).toContain("## Maintenance");
    expect(md).toContain(`### [DB upgrade](/events/maintenance/5.md)`);
  });
});

describe("generateEventsList open-ended maintenance", () => {
  // Regression: `m.to` is nullable; the old `new Date(m.to)` resolved to the
  // epoch and produced a phantom 1970 "COMPLETED" row + a ~56-year duration.
  const page = {
    title: "X",
    description: "",
    monitors: [],
    statusReports: [],
    maintenances: [
      {
        id: 7,
        title: "Rolling upgrade",
        from: new Date("2026-06-18T00:00:00.000Z"),
        to: null,
        maintenancesToPageComponents: [],
      },
    ],
  } as unknown as OverviewPage;
  const md = generateEventsList(page, BASE);

  test("no phantom COMPLETED row, no 1970 timestamp", () => {
    expect(md).not.toContain("COMPLETED");
    expect(md).not.toContain("1970");
  });
});

describe("escapeCell", () => {
  test("escapes backslash before pipe (CodeQL: incomplete escaping)", () => {
    // input: backslash, pipe → both must end up escaped
    expect(escapeCell(String.raw`\|`)).toBe(String.raw`\\\|`);
    expect(escapeCell("plain")).toBe("plain");
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
    expect(md).toContain("### x Monitoring — Jun 18, 12:00 PM");
    expect(md).toContain("Recovering.");
    expect(md).toContain("### x Investigating — Jun 18, 10:00 AM");
  });

  test("each update lists its own impact, operational shown explicitly", () => {
    expect(md).toContain("affects: API (degraded performance)");
    expect(md).toContain("affects: API (major outage)");
    expect(md).toContain("affects: API (operational)");
  });

  test("frontmatter carries page homepage + contact urls", () => {
    const withUrls = generateReport(report, BASE, {
      homepageUrl: "https://acme.com",
      contactUrl: "mailto:status@acme.com",
    });
    expect(withUrls).toContain('homepage_url: "https://acme.com"');
    expect(withUrls).toContain('contact_url: "mailto:status@acme.com"');
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

  test("frontmatter carries page homepage + contact urls", () => {
    const withUrls = generateMaintenance(maintenance, BASE, {
      homepageUrl: "https://acme.com",
      contactUrl: "mailto:status@acme.com",
    });
    expect(withUrls).toContain('homepage_url: "https://acme.com"');
    expect(withUrls).toContain('contact_url: "mailto:status@acme.com"');
  });

  test("null `to` renders 'ongoing', not a bogus duration", () => {
    const openEnded = {
      ...maintenance,
      to: null,
    } as unknown as MaintenanceDetail;
    const out = generateMaintenance(openEnded, BASE);
    expect(out).toContain("**Window:** Jun 20, 12:00 AM → — · ongoing");
    expect(out).not.toContain("1970");
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

  test("frontmatter carries page homepage + contact urls", () => {
    const withUrls = generateMonitor(monitor, BASE, {
      homepageUrl: "https://acme.com",
      contactUrl: "mailto:status@acme.com",
    });
    expect(withUrls).toContain('homepage_url: "https://acme.com"');
    expect(withUrls).toContain('contact_url: "mailto:status@acme.com"');
  });
});

describe("frontmatter YAML escaping", () => {
  test("escapes newlines so a title cannot break out of its scalar", () => {
    const md = frontmatter({
      title: 'Acme\nstatus" page\r\nv2',
      description: "line1\nline2",
      baseUrl: BASE,
      canonical: BASE,
    });
    expect(md).toContain('title: "Acme\\nstatus\\" page\\r\\nv2"');
    expect(md).toContain('description: "line1\\nline2"');
    // The title value must stay on a single physical line.
    const titleLine = md.split("\n").find((l) => l.startsWith("title:"));
    expect(titleLine).toBe('title: "Acme\\nstatus\\" page\\r\\nv2"');
  });

  test("escapes tabs and other C0 control characters", () => {
    const md = frontmatter({
      title: "a\tbc",
      description: "",
      baseUrl: BASE,
      canonical: BASE,
    });
    expect(md).toContain('title: "a\\tb\\x01c"');
  });
});

describe("escapeLinkLabel", () => {
  test("escapes brackets so a title cannot break a link label", () => {
    expect(escapeLinkLabel("[API] is down")).toBe("\\[API\\] is down");
  });

  test("leaves bracket-free labels untouched", () => {
    expect(escapeLinkLabel("API latency")).toBe("API latency");
  });
});

describe("navLine", () => {
  test("escapes the label of a linked item", () => {
    expect(navLine([{ label: "[x](evil)", url: "/safe" }])).toBe(
      "[\\[x\\](evil)](/safe)",
    );
  });

  test("leaves plain (unlinked) items untouched", () => {
    expect(
      navLine([{ label: "Status" }, { label: "Events", url: "/e.md" }]),
    ).toBe("Status › [Events](/e.md)");
  });
});

describe("eventLog", () => {
  test("strips a lone CR so a title cannot close the code fence", () => {
    const out = eventLog([
      {
        timestamp: new Date("2026-06-18T14:50:00.000Z"),
        label: "Outage",
        glyph: "x",
        ref: "R-1",
        title: "down\r```\n# injected",
      },
    ]);
    // CommonMark treats a lone CR as a line ending; if it survived, the trailing
    // ``` would start a new line and close the fence early.
    expect(out).not.toContain("\r");
    expect(out.startsWith("```text\n")).toBe(true);
    expect(out.endsWith("\n```")).toBe(true);
    expect(out).toContain("down ``` # injected");
  });
});
