import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import {
  MOCK_INCIDENTS,
  MOCK_MONITORS,
  MOCK_MONITOR_GROUPS,
  MOCK_STATUS_PAGES,
  MOCK_STATUS_PAGE_SECTIONS,
} from "./fixtures";
import { createBetterstackProvider } from "./provider";

const originalFetch = globalThis.fetch;

function makePaginated(data: unknown[]) {
  return {
    data,
    pagination: { first: null, last: null, prev: null, next: null },
  };
}

function setupMockFetch() {
  globalThis.fetch = mock((url: string) => {
    const path = new URL(url as string).pathname;
    let body: unknown;

    if (path.includes("/api/v2/monitors")) {
      body = makePaginated(MOCK_MONITORS);
    } else if (path.includes("/api/v2/monitor-groups")) {
      body = makePaginated(MOCK_MONITOR_GROUPS);
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

  test("validate returns invalid on API error", async () => {
    globalThis.fetch = mock(() =>
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
    expect(result.error).toContain("401");
  });

  test("run produces correct phase structure", async () => {
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
    expect(phaseNames).toContain("monitorGroups");
    expect(phaseNames).toContain("sections");
    expect(phaseNames).toContain("incidents");
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

  test("incidents phase maps all incidents", async () => {
    const provider = createBetterstackProvider();
    const summary = await provider.run({
      apiKey: "test-key",
      workspaceId: 42,
    });

    const incidentsPhase = summary.phases.find((p) => p.phase === "incidents");
    expect(incidentsPhase).toBeDefined();
    expect(incidentsPhase?.resources).toHaveLength(3);
  });

  test("filters by betterstackStatusPageId", async () => {
    const provider = createBetterstackProvider();
    const summary = await provider.run({
      apiKey: "test-key",
      workspaceId: 42,
      betterstackStatusPageId: "nonexistent",
    });

    // No status page matched → no page phase, but still has monitorGroups
    const pagePhase = summary.phases.find((p) => p.phase === "page");
    expect(pagePhase).toBeUndefined();

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
