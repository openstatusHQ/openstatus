import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  services: [] as Record<string, unknown>[],
  latest: [] as Record<string, unknown>[],
  open: [] as Record<string, unknown>[],
  latestCalls: [] as unknown[],
}));

vi.mock("../../context", () => ({
  defaultTb: {
    externalStatusLatest: async (args: unknown) => {
      mocks.latestCalls.push(args);
      return { data: mocks.latest };
    },
  },
}));
vi.mock("../../external-service", () => ({
  listExternalServices: async () => mocks.services,
  getExternalServiceBySlug: async () => null,
}));
vi.mock("../../external-service-component", () => ({
  listExternalComponentsBySlug: async () => ({
    service: null,
    supported: false,
    components: [],
  }),
}));
vi.mock("../../external-service-report", () => ({
  getServiceReportWindows: async () => [],
  getComponentReportWindows: async () => [],
}));
vi.mock("../../external-service-incident", () => ({
  listExternalIncidentsByComponent: async () => [],
  listExternalIncidentsByServiceId: async () => [],
  listExternalIncidentsBySlug: async () => ({
    service: null,
    supported: false,
    incidents: [],
  }),
  listOpenExternalIncidents: async () => mocks.open,
}));

const { listActiveExternalIssues } = await import("../status");

function service(
  id: number,
  slug: string,
  name: string,
  aliases: string[] = [],
) {
  return { id, slug, name, aliases, deletedAt: null };
}

function snapshot(id: string, indicator: string, ageMs = 60_000) {
  return {
    id,
    indicator,
    status: "operational",
    status_message: "",
    last_fetched_at: Date.now() - ageMs,
  };
}

// The services list is cached per machine for a minute: one fixed directory.
mocks.services = [
  service(1, "github", "GitHub"),
  service(2, "acme", "Acme", ["acme-old"]),
  service(3, "calm", "Calm"),
];

beforeEach(() => {
  mocks.latest = [];
  mocks.open = [];
  mocks.latestCalls = [];
});

describe("listActiveExternalIssues", () => {
  test("an open incident counts when the snapshot is calm", async () => {
    mocks.latest = [snapshot("github", "none"), snapshot("calm", "none")];
    mocks.open = [{ externalServiceId: 1, name: "Actions delayed" }];
    const res = await listActiveExternalIssues({});
    expect(res.issues.map((i) => [i.slug, i.openIncident])).toEqual([
      ["github", "Actions delayed"],
    ]);
  });

  test("an open incident counts when the snapshot is stale or missing", async () => {
    mocks.latest = [snapshot("github", "none", 2 * 60 * 60 * 1000)];
    mocks.open = [
      { externalServiceId: 1, name: "Actions delayed" },
      { externalServiceId: 2, name: "API errors" },
    ];
    const res = await listActiveExternalIssues({});
    expect(res.issues.map((i) => [i.slug, i.status, i.openIncident])).toEqual([
      ["acme", "unknown", "API errors"],
      ["github", "unknown", "Actions delayed"],
    ]);
  });

  test("a stale outage is not a problem now", async () => {
    mocks.latest = [snapshot("github", "critical", 2 * 60 * 60 * 1000)];
    const res = await listActiveExternalIssues({});
    expect(res.total).toBe(0);
  });

  test("reads the newest snapshot across a service's aliases", async () => {
    mocks.latest = [
      snapshot("acme", "none", 10 * 60_000),
      snapshot("acme-old", "major", 60_000),
    ];
    const res = await listActiveExternalIssues({ services: ["acme"] });
    expect(res.issues.map((i) => [i.slug, i.status])).toEqual([
      ["acme", "partial_outage"],
    ]);
    expect(mocks.latestCalls).toEqual([{ ids: ["acme", "acme-old"] }]);
  });

  test("only unknown names: no snapshot read at all", async () => {
    const res = await listActiveExternalIssues({ services: ["nope-zzz"] });
    expect(res).toEqual({ total: 0, issues: [], unknown: ["nope-zzz"] });
    expect(mocks.latestCalls).toEqual([]);
  });
});
