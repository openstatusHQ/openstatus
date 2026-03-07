import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import {
  MOCK_COMPONENTS,
  MOCK_COMPONENT_GROUPS,
  MOCK_INCIDENTS,
  MOCK_PAGES,
  MOCK_SUBSCRIBERS,
} from "./fixtures";
import {
  type StatuspageImportConfig,
  createStatuspageProvider,
} from "./provider";

function createMockFetch(options?: { failAuth?: boolean }) {
  return (input: string | URL | Request): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString();

    if (options?.failAuth) {
      return Promise.resolve(
        new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          statusText: "Unauthorized",
        }),
      );
    }

    if (url.endsWith("/pages")) {
      return Promise.resolve(Response.json(MOCK_PAGES));
    }
    if (url.match(/\/pages\/[^/]+\/components$/)) {
      return Promise.resolve(Response.json(MOCK_COMPONENTS));
    }
    if (url.match(/\/pages\/[^/]+\/component-groups$/)) {
      return Promise.resolve(Response.json(MOCK_COMPONENT_GROUPS));
    }
    if (url.match(/\/pages\/[^/]+\/incidents$/)) {
      return Promise.resolve(Response.json(MOCK_INCIDENTS));
    }
    if (url.match(/\/pages\/[^/]+\/subscribers$/)) {
      return Promise.resolve(Response.json(MOCK_SUBSCRIBERS));
    }

    return Promise.resolve(
      new Response("Not Found", { status: 404, statusText: "Not Found" }),
    );
  };
}

describe("StatuspageImportProvider", () => {
  const originalFetch = globalThis.fetch;

  beforeAll(() => {
    globalThis.fetch = createMockFetch() as typeof fetch;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it("has name 'statuspage'", () => {
    const provider = createStatuspageProvider();
    expect(provider.name).toBe("statuspage");
  });

  it("validate returns valid for working key", async () => {
    const provider = createStatuspageProvider();
    const result = await provider.validate({
      apiKey: "test-key",
      workspaceId: 1,
    });
    expect(result).toEqual({ valid: true });
  });

  it("validate returns error for 401", async () => {
    const prev = globalThis.fetch;
    globalThis.fetch = createMockFetch({ failAuth: true }) as typeof fetch;

    const provider = createStatuspageProvider();
    const result = await provider.validate({
      apiKey: "bad-key",
      workspaceId: 1,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();

    globalThis.fetch = prev;
  });

  it("run with dryRun returns correct phase counts", async () => {
    const provider = createStatuspageProvider();
    const config: StatuspageImportConfig = {
      apiKey: "test-key",
      workspaceId: 1,
      dryRun: true,
    };

    const summary = await provider.run(config);

    expect(summary.provider).toBe("statuspage");
    expect(summary.status).toBe("completed");

    const findPhase = (name: string) =>
      summary.phases.find((p) => p.phase === name);

    // 1 page
    expect(findPhase("page")?.resources).toHaveLength(1);

    // 1 component group
    expect(findPhase("componentGroups")?.resources).toHaveLength(1);

    // 4 components
    expect(findPhase("components")?.resources).toHaveLength(4);

    // 2 realtime incidents (incident_001 and incident_002; incident_003 is scheduled)
    expect(findPhase("incidents")?.resources).toHaveLength(2);

    // 1 maintenance (incident_003)
    expect(findPhase("maintenances")?.resources).toHaveLength(1);

    // 3 subscribers: 2 email + 1 webhook (sms + slack skipped)
    expect(findPhase("subscribers")?.resources).toHaveLength(3);
  });
});
