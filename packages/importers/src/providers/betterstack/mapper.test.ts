import { describe, expect, test } from "bun:test";
import {
  MOCK_INCIDENTS,
  MOCK_MONITORS,
  MOCK_MONITOR_GROUPS,
  MOCK_STATUS_PAGES,
  MOCK_STATUS_PAGE_RESOURCES,
  MOCK_STATUS_PAGE_SECTIONS,
  MOCK_STATUS_REPORTS,
  MOCK_STATUS_UPDATES_REPORT_001,
  MOCK_STATUS_UPDATES_REPORT_002,
  MOCK_STATUS_UPDATES_REPORT_003,
} from "./fixtures";
import {
  mapFrequency,
  mapIncidentStatus,
  mapIncidentToStatusReport,
  mapMethod,
  mapMonitor,
  mapMonitorGroup,
  mapMonitorType,
  mapRegions,
  mapReportAggregateState,
  mapReportToMaintenance,
  mapReportToStatusReport,
  mapResource,
  mapSection,
  mapStatusPage,
} from "./mapper";

describe("mapFrequency", () => {
  test("maps known values", () => {
    expect(mapFrequency(30)).toBe("30s");
    expect(mapFrequency(60)).toBe("1m");
    expect(mapFrequency(300)).toBe("5m");
    expect(mapFrequency(600)).toBe("10m");
    expect(mapFrequency(1800)).toBe("30m");
    expect(mapFrequency(3600)).toBe("1h");
  });

  test("snaps to nearest supported value", () => {
    expect(mapFrequency(45)).toBe("30s");
    expect(mapFrequency(90)).toBe("1m");
    expect(mapFrequency(400)).toBe("5m");
    expect(mapFrequency(900)).toBe("10m");
    expect(mapFrequency(2400)).toBe("30m");
  });
});

describe("mapRegions", () => {
  test("maps known regions", () => {
    expect(mapRegions(["us"])).toBe("iad");
    expect(mapRegions(["eu"])).toBe("fra");
    expect(mapRegions(["as"])).toBe("sin");
    expect(mapRegions(["au"])).toBe("syd");
  });

  test("maps multiple regions", () => {
    expect(mapRegions(["us", "eu"])).toBe("iad,fra");
    expect(mapRegions(["us", "eu", "as", "au"])).toBe("iad,fra,sin,syd");
  });

  test("returns default for unknown regions", () => {
    expect(mapRegions([])).toBe("iad");
    expect(mapRegions(["unknown"])).toBe("iad");
  });
});

describe("mapMonitorType", () => {
  test("maps known types", () => {
    expect(mapMonitorType("status")).toBe("http");
    expect(mapMonitorType("keyword")).toBe("http");
    expect(mapMonitorType("expected_status_code")).toBe("http");
    expect(mapMonitorType("tcp")).toBe("tcp");
    expect(mapMonitorType("udp")).toBe("udp");
    expect(mapMonitorType("dns")).toBe("dns");
  });

  test("defaults to http for unknown types", () => {
    expect(mapMonitorType("unknown")).toBe("http");
  });
});

describe("mapMethod", () => {
  test("uppercases method", () => {
    expect(mapMethod("get")).toBe("GET");
    expect(mapMethod("post")).toBe("POST");
    expect(mapMethod("head")).toBe("HEAD");
  });
});

describe("mapMonitor", () => {
  test("maps a full monitor", () => {
    const result = mapMonitor(MOCK_MONITORS[0], 42);
    expect(result.workspaceId).toBe(42);
    expect(result.url).toBe("https://api.acmecorp.com/health");
    expect(result.name).toBe("API Health Check");
    expect(result.jobType).toBe("http");
    expect(result.method).toBe("GET");
    expect(result.periodicity).toBe("1m");
    expect(result.timeout).toBe(15000);
    expect(result.active).toBe(true);
    expect(result.regions).toBe("iad,fra");
    expect(result.headers).toContain("X-Custom-Header");
  });

  test("maps a paused monitor", () => {
    const result = mapMonitor(MOCK_MONITORS[2], 42);
    expect(result.active).toBe(false);
    expect(result.method).toBe("HEAD");
  });

  test("maps monitor with empty headers", () => {
    const result = mapMonitor(MOCK_MONITORS[1], 42);
    expect(result.headers).toBe("");
  });
});

describe("mapMonitorGroup", () => {
  test("maps a monitor group", () => {
    const result = mapMonitorGroup(MOCK_MONITOR_GROUPS[0], 42, 1);
    expect(result.workspaceId).toBe(42);
    expect(result.pageId).toBe(1);
    expect(result.name).toBe("Core Services");
  });
});

describe("mapStatusPage", () => {
  test("maps a status page", () => {
    const result = mapStatusPage(MOCK_STATUS_PAGES[0], 42);
    expect(result.workspaceId).toBe(42);
    expect(result.title).toBe("Acme Corp");
    expect(result.slug).toBe("acmecorp");
    expect(result.customDomain).toBe("status.acmecorp.com");
    expect(result.published).toBe(true);
  });
});

describe("mapSection", () => {
  test("maps a section", () => {
    const result = mapSection(MOCK_STATUS_PAGE_SECTIONS[0], 42, 1);
    expect(result.workspaceId).toBe(42);
    expect(result.pageId).toBe(1);
    expect(result.name).toBe("API Services");
  });

  test("section id matches resource sourceGroupId", () => {
    // Section id (string) must match String(resource.status_page_section_id)
    const sectionId = MOCK_STATUS_PAGE_SECTIONS[0].id;
    const resourceSectionId = String(
      MOCK_STATUS_PAGE_RESOURCES[0].attributes.status_page_section_id,
    );
    expect(sectionId).toBe(resourceSectionId);
  });
});

describe("mapResource", () => {
  const monitorMap = new Map([
    ["1001", "1001"],
    ["1002", "1002"],
    ["1003", "1003"],
  ]);

  test("maps a monitor resource with section", () => {
    const result = mapResource(
      MOCK_STATUS_PAGE_RESOURCES[0],
      42,
      1,
      monitorMap,
    );
    expect(result.workspaceId).toBe(42);
    expect(result.pageId).toBe(1);
    expect(result.type).toBe("monitor");
    expect(result.monitorId).toBeNull();
    expect(result.sourceMonitorId).toBe("1001");
    expect(result.name).toBe("API Gateway");
    expect(result.description).toBe("Main API endpoint health");
    expect(result.order).toBe(0);
    expect(result.sourceGroupId).toBe("100001");
  });

  test("maps a resource without section", () => {
    const result = mapResource(
      MOCK_STATUS_PAGE_RESOURCES[2],
      42,
      1,
      monitorMap,
    );
    expect(result.name).toBe("CDN");
    expect(result.description).toBeNull();
    expect(result.sourceGroupId).toBeNull();
  });

  test("maps a resource without pageId", () => {
    const result = mapResource(
      MOCK_STATUS_PAGE_RESOURCES[0],
      42,
      undefined,
      monitorMap,
    );
    expect(result.pageId).toBeUndefined();
  });

  test("sourceMonitorId is null without lookup map", () => {
    const result = mapResource(MOCK_STATUS_PAGE_RESOURCES[0], 42, 1);
    expect(result.type).toBe("monitor");
    expect(result.sourceMonitorId).toBeNull();
  });

  test("sourceMonitorId is null when resource_id not in lookup map", () => {
    const emptyMap = new Map<string, string>();
    const result = mapResource(MOCK_STATUS_PAGE_RESOURCES[0], 42, 1, emptyMap);
    expect(result.type).toBe("monitor");
    expect(result.sourceMonitorId).toBeNull();
  });
});

describe("mapReportAggregateState", () => {
  test("maps known states", () => {
    expect(mapReportAggregateState("Operational")).toBe("resolved");
    expect(mapReportAggregateState("Downtime")).toBe("investigating");
    expect(mapReportAggregateState("Degraded")).toBe("identified");
    expect(mapReportAggregateState("Maintenance")).toBe("monitoring");
  });

  test("maps lowercase states", () => {
    expect(mapReportAggregateState("resolved")).toBe("resolved");
    expect(mapReportAggregateState("downtime")).toBe("investigating");
    expect(mapReportAggregateState("degraded")).toBe("identified");
  });

  test("defaults to investigating for null/unknown", () => {
    expect(mapReportAggregateState(null)).toBe("investigating");
    expect(mapReportAggregateState("unknown")).toBe("investigating");
  });
});

describe("mapReportToStatusReport", () => {
  test("maps a resolved report with 3 updates", () => {
    const result = mapReportToStatusReport(
      MOCK_STATUS_REPORTS[0],
      MOCK_STATUS_UPDATES_REPORT_001,
      42,
      1,
    );
    expect(result.report.title).toBe("API Gateway Elevated Error Rates");
    expect(result.report.workspaceId).toBe(42);
    expect(result.report.pageId).toBe(1);
    expect(result.updates).toHaveLength(3);
    // Updates sorted by published_at
    expect(result.updates[0].message).toContain("investigating");
    expect(result.updates[2].message).toContain("resolved");
    // Last update determines report status
    expect(result.report.status).toBe("resolved");
    // sourceComponentIds from affected_resources
    expect(result.sourceComponentIds).toEqual(["bs_res_001"]);
  });

  test("maps an ongoing report with 1 update", () => {
    const result = mapReportToStatusReport(
      MOCK_STATUS_REPORTS[1],
      MOCK_STATUS_UPDATES_REPORT_002,
      42,
      1,
    );
    expect(result.report.title).toBe("Dashboard Slow Responses");
    expect(result.updates).toHaveLength(1);
    expect(result.report.status).toBe("identified");
    expect(result.sourceComponentIds).toEqual(["bs_res_002"]);
  });

  test("creates synthetic update when no updates exist", () => {
    const result = mapReportToStatusReport(MOCK_STATUS_REPORTS[0], [], 42);
    expect(result.updates).toHaveLength(1);
    expect(result.updates[0].message).toBe("API Gateway Elevated Error Rates");
    expect(result.report.pageId).toBeUndefined();
  });
});

describe("mapReportToMaintenance", () => {
  test("maps a maintenance report with dates", () => {
    const result = mapReportToMaintenance(
      MOCK_STATUS_REPORTS[2],
      MOCK_STATUS_UPDATES_REPORT_003,
      42,
      1,
    );
    expect(result.title).toBe("Scheduled Database Maintenance");
    expect(result.workspaceId).toBe(42);
    expect(result.pageId).toBe(1);
    expect(result.from).toEqual(new Date("2024-06-15T02:00:00.000Z"));
    expect(result.to).toEqual(new Date("2024-06-15T06:00:00.000Z"));
    expect(result.sourceComponentIds).toEqual(["bs_res_001", "bs_res_002"]);
    // Message is joined from update messages
    expect(result.message).toContain("begin shortly");
    expect(result.message).toContain("completed successfully");
  });

  test("uses title as message when no updates", () => {
    const result = mapReportToMaintenance(MOCK_STATUS_REPORTS[2], [], 42);
    expect(result.message).toBe("Scheduled Database Maintenance");
  });
});

describe("mapIncidentStatus", () => {
  test("maps known statuses", () => {
    expect(mapIncidentStatus("started")).toBe("investigating");
    expect(mapIncidentStatus("acknowledged")).toBe("identified");
    expect(mapIncidentStatus("resolved")).toBe("resolved");
  });

  test("defaults to investigating", () => {
    expect(mapIncidentStatus("unknown")).toBe("investigating");
  });
});

describe("mapIncidentToStatusReport", () => {
  test("maps a fully resolved incident with 3 updates", () => {
    const result = mapIncidentToStatusReport(MOCK_INCIDENTS[0], 42, 1);
    expect(result.report.title).toBe("API Gateway Outage");
    expect(result.report.status).toBe("resolved");
    expect(result.report.workspaceId).toBe(42);
    expect(result.report.pageId).toBe(1);
    expect(result.updates).toHaveLength(3);
    expect(result.updates[0].status).toBe("investigating");
    expect(result.updates[1].status).toBe("identified");
    expect(result.updates[2].status).toBe("resolved");
    expect(result.sourceComponentIds).toEqual([]);
  });

  test("maps an acknowledged (unresolved) incident", () => {
    const result = mapIncidentToStatusReport(MOCK_INCIDENTS[1], 42, 1);
    expect(result.report.status).toBe("identified");
    expect(result.updates).toHaveLength(2);
    expect(result.sourceComponentIds).toEqual([]);
  });

  test("maps an incident with null name", () => {
    const result = mapIncidentToStatusReport(MOCK_INCIDENTS[2], 42, 1);
    expect(result.report.title).toBe("Incident on https://cdn.acmecorp.com");
    expect(result.report.status).toBe("resolved");
    expect(result.updates).toHaveLength(2);
  });

  test("maps incident with null cause", () => {
    const result = mapIncidentToStatusReport(MOCK_INCIDENTS[2], 42);
    expect(result.updates[0].message).toBe(
      "Incident detected on https://cdn.acmecorp.com",
    );
    expect(result.report.pageId).toBeUndefined();
  });
});
