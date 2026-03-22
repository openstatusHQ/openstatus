import { describe, expect, test } from "bun:test";
import {
  MOCK_INCIDENTS,
  MOCK_MONITORS,
  MOCK_MONITOR_GROUPS,
  MOCK_STATUS_PAGES,
  MOCK_STATUS_PAGE_SECTIONS,
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
    expect(result.periodicity).toBe("5m");
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
  });

  test("maps an acknowledged (unresolved) incident", () => {
    const result = mapIncidentToStatusReport(MOCK_INCIDENTS[1], 42, 1);
    expect(result.report.status).toBe("identified");
    expect(result.updates).toHaveLength(2);
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
