import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { BetterstackStatusUpdate } from "./api-types";
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
import { createBetterstackProvider } from "./index";

const originalFetch = globalThis.fetch;

function makePaginated(data: unknown[]) {
  return {
    data,
    pagination: { first: null, last: null, prev: null, next: null },
  };
}

function setupMockFetch(
  updates: BetterstackStatusUpdate[] = MOCK_STATUS_UPDATES_REPORT_001,
) {
  globalThis.fetch = vi.fn((url: string) => {
    const path = new URL(url as string).pathname;
    let body: unknown;

    if (path.includes("/api/v2/monitors")) {
      body = makePaginated(MOCK_MONITORS);
    } else if (path.includes("/api/v2/monitor-groups")) {
      body = makePaginated(MOCK_MONITOR_GROUPS);
    } else if (path.includes("/status-updates")) {
      // Match status updates by report ID in the path
      if (path.includes("/bs_report_001/")) {
        body = makePaginated(updates);
      } else if (path.includes("/bs_report_002/")) {
        body = makePaginated(MOCK_STATUS_UPDATES_REPORT_002);
      } else if (path.includes("/bs_report_003/")) {
        body = makePaginated(MOCK_STATUS_UPDATES_REPORT_003);
      } else {
        body = makePaginated([]);
      }
    } else if (path.includes("/status-reports")) {
      body = makePaginated(MOCK_STATUS_REPORTS);
    } else if (path.includes("/resources")) {
      body = makePaginated(MOCK_STATUS_PAGE_RESOURCES);
    } else if (path.includes("/sections")) {
      body = makePaginated(MOCK_STATUS_PAGE_SECTIONS);
    } else if (path.includes("/api/v2/status-pages")) {
      body = makePaginated(MOCK_STATUS_PAGES);
    } else if (path.includes("/api/v3/incidents")) {
      body = makePaginated(MOCK_INCIDENTS);
    } else {
      body = makePaginated([]);
    }

    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status: 200,
        statusText: "OK",
        headers: { "Content-Type": "application/json" },
      }),
    );
  }) as typeof globalThis.fetch;
}

describe("BetterstackProvider", () => {
  beforeEach(() => {
    setupMockFetch();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("validate returns valid with good API key", async () => {
    const provider = createBetterstackProvider();
    const result = await provider.validate({
      apiKey: "test-key",
      workspaceId: 1,
    });
    expect(result.valid).toBe(true);
  });

  test("validate returns friendly 401 error", async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          statusText: "Unauthorized",
          headers: { "Content-Type": "application/json" },
        }),
      ),
    ) as typeof globalThis.fetch;

    const provider = createBetterstackProvider();
    const result = await provider.validate({
      apiKey: "bad-key",
      workspaceId: 1,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid BetterStack API token");
  });

  test("run produces correct phase structure with status page", async () => {
    const provider = createBetterstackProvider();
    const summary = await provider.run({
      apiKey: "test-key",
      workspaceId: 42,
    });

    expect(summary.provider).toBe("betterstack");
    expect(summary.status).toBe("completed");
    expect(summary.errors).toEqual([]);

    const phaseNames = summary.phases.map((p) => p.phase);
    expect(phaseNames).toContain("monitors");
    expect(phaseNames).toContain("page");
    expect(phaseNames).toContain("componentGroups");
    expect(phaseNames).toContain("components");
    expect(phaseNames).toContain("incidents");
    expect(phaseNames).toContain("maintenances");
  });

  test("monitors phase has correct resource count", async () => {
    const provider = createBetterstackProvider();
    const summary = await provider.run({
      apiKey: "test-key",
      workspaceId: 42,
    });

    const monitorsPhase = summary.phases.find((p) => p.phase === "monitors");
    expect(monitorsPhase).toBeDefined();
    expect(monitorsPhase?.resources).toHaveLength(3);
    expect(monitorsPhase?.resources[0].name).toBe("API Health Check");
  });

  test("page phase maps status page correctly", async () => {
    const provider = createBetterstackProvider();
    const summary = await provider.run({
      apiKey: "test-key",
      workspaceId: 42,
    });

    const pagePhase = summary.phases.find((p) => p.phase === "page");
    expect(pagePhase).toBeDefined();
    expect(pagePhase?.resources).toHaveLength(1);
    expect(pagePhase?.resources[0].name).toBe("Acme Corp");
  });

  test("components phase maps status page resources", async () => {
    const provider = createBetterstackProvider();
    const summary = await provider.run({
      apiKey: "test-key",
      workspaceId: 42,
    });

    const componentsPhase = summary.phases.find(
      (p) => p.phase === "components",
    );
    expect(componentsPhase).toBeDefined();
    expect(componentsPhase?.resources).toHaveLength(3);
    expect(componentsPhase?.resources[0].name).toBe("API Gateway");
    expect(componentsPhase?.resources[2].name).toBe("CDN");
  });

  test("incidents phase uses status page reports (not v3 incidents)", async () => {
    const provider = createBetterstackProvider();
    const summary = await provider.run({
      apiKey: "test-key",
      workspaceId: 42,
    });

    const incidentsPhase = summary.phases.find((p) => p.phase === "incidents");
    expect(incidentsPhase).toBeDefined();
    // 2 manual reports (report_001 and report_002), not the 3 v3 incidents
    expect(incidentsPhase?.resources).toHaveLength(2);
    expect(incidentsPhase?.resources[0].name).toBe(
      "API Gateway Elevated Error Rates",
    );

    const data = incidentsPhase?.resources[0].data as Record<string, unknown>;
    expect(data.sourceComponentIds).toEqual(["bs_res_001"]);
  });

  test.each([
    {
      states: ["resolved", "downtime"],
      expected: "investigating",
      impact: "major_outage",
    },
    {
      states: ["downtime", "resolved"],
      expected: "investigating",
      impact: "major_outage",
    },
    {
      states: ["resolved", "degraded"],
      expected: "identified",
      impact: "degraded_performance",
    },
    {
      states: ["degraded", "resolved"],
      expected: "identified",
      impact: "degraded_performance",
    },
  ])(
    "imports partial recovery $states as $expected",
    async ({ states, expected, impact }) => {
      setupMockFetch([
        {
          ...MOCK_STATUS_UPDATES_REPORT_001[0],
          attributes: {
            ...MOCK_STATUS_UPDATES_REPORT_001[0].attributes,
            affected_resources: states.map((status) => ({
              status_page_resource_id: status === "resolved" ? "api" : "db",
              status,
            })),
          },
        },
      ]);
      const summary = await createBetterstackProvider().run({
        apiKey: "test-key",
        workspaceId: 42,
      });
      expect(summary.status).toBe("completed");
      expect(summary.errors).toEqual([]);
      const incident = summary.phases.find(
        (phase) => phase.phase === "incidents",
      )?.resources[0]?.data;
      expect(incident).toMatchObject({
        report: { status: expected },
        updates: [
          {
            status: expected,
            componentImpacts: expect.arrayContaining([
              { sourceComponentId: "api", impact: "operational" },
              { sourceComponentId: "db", impact },
            ]),
          },
        ],
      });
    },
  );

  test.each([false, true])(
    "imports partial update history (reverse initial order: %s)",
    async (reverse) => {
      const initial = [
        { status_page_resource_id: "api", status: "downtime" },
        { status_page_resource_id: "db", status: "downtime" },
      ];
      setupMockFetch(
        [
          reverse ? [...initial].reverse() : initial,
          [{ status_page_resource_id: "api", status: "resolved" }],
          [{ status_page_resource_id: "db", status: "degraded" }],
          [],
        ]
          .map((affected_resources, index) => ({
            ...MOCK_STATUS_UPDATES_REPORT_001[0],
            id: `update-${index}`,
            attributes: {
              ...MOCK_STATUS_UPDATES_REPORT_001[0].attributes,
              published_at: `2024-06-01T1${index}:00:00Z`,
              affected_resources,
            },
          }))
          .reverse(),
      );
      const summary = await createBetterstackProvider().run({
        apiKey: "test-key",
        workspaceId: 42,
      });
      expect(summary.status).toBe("completed");
      expect(summary.errors).toEqual([]);
      expect(
        summary.phases.find((phase) => phase.phase === "incidents")
          ?.resources[0]?.data,
      ).toMatchObject({
        report: { status: "identified" },
        updates: [
          { status: "investigating" },
          {
            status: "investigating",
            componentImpacts: [
              { sourceComponentId: "api", impact: "operational" },
            ],
          },
          {
            status: "identified",
            componentImpacts: [
              { sourceComponentId: "db", impact: "degraded_performance" },
            ],
          },
          { status: "identified", componentImpacts: [] },
        ],
      });
    },
  );

  test("maintenances phase maps maintenance reports", async () => {
    const provider = createBetterstackProvider();
    const summary = await provider.run({
      apiKey: "test-key",
      workspaceId: 42,
    });

    const maintenancesPhase = summary.phases.find(
      (p) => p.phase === "maintenances",
    );
    expect(maintenancesPhase).toBeDefined();
    expect(maintenancesPhase?.resources).toHaveLength(1);
    expect(maintenancesPhase?.resources[0].name).toBe(
      "Scheduled Database Maintenance",
    );

    const data = maintenancesPhase?.resources[0].data as Record<
      string,
      unknown
    >;
    expect(data.sourceComponentIds).toEqual(["bs_res_001", "bs_res_002"]);
  });

  test("falls back to v3 incidents when no status pages", async () => {
    const provider = createBetterstackProvider();
    const summary = await provider.run({
      apiKey: "test-key",
      workspaceId: 42,
      betterstackStatusPageId: "nonexistent",
    });

    // No status page matched → no page, components, sections, maintenances phases
    const pagePhase = summary.phases.find((p) => p.phase === "page");
    expect(pagePhase).toBeUndefined();

    const componentsPhase = summary.phases.find(
      (p) => p.phase === "components",
    );
    expect(componentsPhase).toBeUndefined();

    const maintenancesPhase = summary.phases.find(
      (p) => p.phase === "maintenances",
    );
    expect(maintenancesPhase).toBeUndefined();

    // Falls back to v3 incidents
    const incidentsPhase = summary.phases.find((p) => p.phase === "incidents");
    expect(incidentsPhase).toBeDefined();
    expect(incidentsPhase?.resources).toHaveLength(3);

    // Still has monitors and monitorGroups
    const monitorsPhase = summary.phases.find((p) => p.phase === "monitors");
    expect(monitorsPhase).toBeDefined();
    expect(monitorsPhase?.resources).toHaveLength(3);
  });

  test("monitor resources include sourceMonitorGroupId", async () => {
    const provider = createBetterstackProvider();
    const summary = await provider.run({
      apiKey: "test-key",
      workspaceId: 42,
    });

    const monitorsPhase = summary.phases.find((p) => p.phase === "monitors");
    const firstMonitor = monitorsPhase?.resources[0].data as Record<
      string,
      unknown
    >;
    expect(firstMonitor.sourceMonitorGroupId).toBe("bs_group_001");

    const thirdMonitor = monitorsPhase?.resources[2].data as Record<
      string,
      unknown
    >;
    expect(thirdMonitor.sourceMonitorGroupId).toBeNull();
  });
});
