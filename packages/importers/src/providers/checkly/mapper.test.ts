import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import {
  MOCK_CHECKS,
  MOCK_INCIDENTS,
  MOCK_MAINTENANCE_WINDOWS,
  MOCK_STATUS_PAGES,
} from "./fixtures";
import {
  deriveSlug,
  mapCheck,
  mapCheckType,
  mapFrequency,
  mapIncidentToStatusReport,
  mapMaintenance,
  mapMethod,
  mapPage,
  mapRegions,
  mapService,
} from "./mapper";

describe("mapCheckType", () => {
  test("maps supported HTTP-family types", () => {
    expect(mapCheckType("API")).toBe("http");
    expect(mapCheckType("URL")).toBe("http");
    expect(mapCheckType("TCP")).toBe("tcp");
    expect(mapCheckType("DNS")).toBe("dns");
    expect(mapCheckType("ssl")).toBe("ssl");
  });

  test("returns null for unsupported types", () => {
    expect(mapCheckType("BROWSER")).toBeNull();
    expect(mapCheckType("MULTI_STEP")).toBeNull();
    expect(mapCheckType("SOMETHING_NEW")).toBeNull();
  });
});

describe("mapFrequency", () => {
  test("maps known frequencies", () => {
    expect(mapFrequency(0)).toBe("30s");
    expect(mapFrequency(1)).toBe("1m");
    expect(mapFrequency(5)).toBe("5m");
    expect(mapFrequency(10)).toBe("10m");
    expect(mapFrequency(30)).toBe("30m");
    expect(mapFrequency(60)).toBe("1h");
  });

  test("snaps long frequencies down to 1h", () => {
    expect(mapFrequency(120)).toBe("1h");
    expect(mapFrequency(1440)).toBe("1h");
  });
});

describe("mapRegions", () => {
  test("maps AWS locations to fly regions", () => {
    expect(mapRegions(["us-east-1", "eu-west-1"])).toBe("iad,lhr");
  });

  test("dedupes collapsed regions", () => {
    expect(mapRegions(["us-east-1", "us-east-2"])).toBe("iad");
  });

  test("falls back to iad for unknown or empty", () => {
    expect(mapRegions([])).toBe("iad");
    expect(mapRegions(["mars-1"])).toBe("iad");
  });
});

describe("mapMethod", () => {
  test("uppercases and validates", () => {
    expect(mapMethod("get")).toBe("GET");
    expect(mapMethod("post")).toBe("POST");
    expect(mapMethod("bogus")).toBe("GET");
  });
});

describe("mapCheck", () => {
  test("maps an API check to a monitor", () => {
    const m = mapCheck(MOCK_CHECKS[0], 42);
    expect(m.workspaceId).toBe(42);
    expect(m.jobType).toBe("http");
    expect(m.periodicity).toBe("5m");
    expect(m.active).toBe(true);
    expect(m.regions).toBe("iad,lhr");
    expect(m.url).toBe("https://api.acmecorp.com/health");
    expect(m.method).toBe("GET");
    expect(m.timeout).toBe(20000);
    expect(m.sourceMonitorGroupId).toBe("grp_core");
    expect(JSON.parse(m.headers)).toEqual([{ key: "X-Env", value: "prod" }]);
  });

  test("a muted + deactivated check maps to active:false", () => {
    const m = mapCheck(MOCK_CHECKS[3], 1);
    expect(m.active).toBe(false);
    expect(m.method).toBe("POST");
  });
});

describe("deriveSlug", () => {
  test("reduces url or name to a slug token", () => {
    expect(deriveSlug("acmecorp")).toBe("acmecorp");
    expect(deriveSlug("https://status.acme.com/foo")).toBe("status");
    expect(deriveSlug("Acme Status")).toBe("acme-status");
  });
});

describe("mapPage", () => {
  test("maps a status page", () => {
    const p = mapPage(MOCK_STATUS_PAGES[0], 7);
    expect(p.title).toBe("Acme Status");
    expect(p.slug).toBe("acmecorp");
    expect(p.customDomain).toBe("status.acmecorp.com");
    expect(p.published).toBe(true);
    expect(p.icon).toBe("https://acmecorp.com/logo.png");
  });
});

describe("mapService", () => {
  test("maps a service to a static component with group link", () => {
    const svc = MOCK_STATUS_PAGES[0].cards[0].services[0];
    const c = mapService(svc, 7, 0, "card_api", 99);
    expect(c.type).toBe("static");
    expect(c.monitorId).toBeNull();
    expect(c.name).toBe("Public API");
    expect(c.order).toBe(0);
    expect(c.sourceGroupId).toBe("card_api");
    expect(c.pageId).toBe(99);
  });
});

describe("mapIncidentToStatusReport", () => {
  test("maps updates and resolves final status", () => {
    const r = mapIncidentToStatusReport(MOCK_INCIDENTS[0], 7, 99);
    expect(r.report.title).toBe("API elevated error rates");
    expect(r.report.status).toBe("resolved");
    expect(r.updates).toHaveLength(2);
    expect(r.updates[0].status).toBe("investigating");
    expect(r.sourceComponentIds).toEqual(["svc_api"]);
  });

  test("synthesizes an update when none exist", () => {
    const r = mapIncidentToStatusReport(MOCK_INCIDENTS[1], 7, 99);
    expect(r.updates).toHaveLength(1);
    expect(r.report.status).toBe("monitoring");
    expect(r.updates[0].message).toBe("Website degraded");
  });
});

describe("mapMaintenance", () => {
  test("maps a maintenance window", () => {
    const m = mapMaintenance(MOCK_MAINTENANCE_WINDOWS[0], 7, 99);
    expect(m.title).toBe("Database upgrade");
    expect(m.message).toBe("Scheduled database maintenance");
    expect(m.from.toISOString()).toBe("2024-06-15T02:00:00.000Z");
    expect(m.to.toISOString()).toBe("2024-06-15T06:00:00.000Z");
    expect(m.sourceComponentIds).toEqual([]);
  });
});
