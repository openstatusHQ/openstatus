import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import {
  MOCK_COMPONENTS,
  MOCK_INCIDENTS,
  MOCK_MAINTENANCES,
  MOCK_PAGES,
  MOCK_SUBSCRIBERS,
} from "./fixtures";
import { type InstatusImportConfig, createInstatusProvider } from "./provider";

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

    if (url.match(/\/v2\/pages$/)) {
      return Promise.resolve(Response.json(MOCK_PAGES));
    }
    if (url.match(/\/v2\/[^/]+\/components(\?|$)/)) {
      const pageParam = new URL(url).searchParams.get("page");
      return Promise.resolve(
        Response.json(pageParam === "1" || !pageParam ? MOCK_COMPONENTS : []),
      );
    }
    if (url.match(/\/v1\/[^/]+\/incidents(\?|$)/)) {
      const pageParam = new URL(url).searchParams.get("page");
      return Promise.resolve(
        Response.json(pageParam === "1" || !pageParam ? MOCK_INCIDENTS : []),
      );
    }
    if (url.match(/\/v2\/[^/]+\/maintenances(\?|$)/)) {
      const pageParam = new URL(url).searchParams.get("page");
      return Promise.resolve(
        Response.json(pageParam === "1" || !pageParam ? MOCK_MAINTENANCES : []),
      );
    }
    if (url.match(/\/v2\/[^/]+\/subscribers(\?|$)/)) {
      const pageParam = new URL(url).searchParams.get("page");
      return Promise.resolve(
        Response.json(pageParam === "1" || !pageParam ? MOCK_SUBSCRIBERS : []),
      );
    }

    return Promise.resolve(
      new Response("Not Found", { status: 404, statusText: "Not Found" }),
    );
  };
}

describe("InstatusImportProvider", () => {
  const originalFetch = globalThis.fetch;

  beforeAll(() => {
    globalThis.fetch = createMockFetch() as typeof fetch;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it("has name 'instatus'", () => {
    const provider = createInstatusProvider();
    expect(provider.name).toBe("instatus");
  });

  it("validate returns valid for working key", async () => {
    const provider = createInstatusProvider();
    const result = await provider.validate({
      apiKey: "test-key",
      workspaceId: 1,
    });
    expect(result).toEqual({ valid: true });
  });

  it("validate returns error for 401", async () => {
    const prev = globalThis.fetch;
    globalThis.fetch = createMockFetch({ failAuth: true }) as typeof fetch;

    const provider = createInstatusProvider();
    const result = await provider.validate({
      apiKey: "bad-key",
      workspaceId: 1,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();

    globalThis.fetch = prev;
  });

  it("run with dryRun returns correct phase counts", async () => {
    const provider = createInstatusProvider();
    const config: InstatusImportConfig = {
      apiKey: "test-key",
      workspaceId: 1,
      dryRun: true,
    };

    const summary = await provider.run(config);

    expect(summary.provider).toBe("instatus");
    expect(summary.status).toBe("completed");

    const findPhase = (name: string) =>
      summary.phases.find((p) => p.phase === name);

    // 1 page
    expect(findPhase("page")?.resources).toHaveLength(1);

    // 1 component group (in_comp_group_001 is referenced by other components)
    expect(findPhase("componentGroups")?.resources).toHaveLength(1);

    // 4 regular components (group component excluded)
    expect(findPhase("components")?.resources).toHaveLength(4);

    // 2 incidents
    expect(findPhase("incidents")?.resources).toHaveLength(2);

    // 2 maintenances (from dedicated endpoint)
    expect(findPhase("maintenances")?.resources).toHaveLength(2);

    // 2 email subscribers (phone, webhook, and empty all skipped)
    expect(findPhase("subscribers")?.resources).toHaveLength(2);
  });

  it("reports skipped non-email subscribers", async () => {
    const provider = createInstatusProvider();
    const summary = await provider.run({
      apiKey: "test-key",
      workspaceId: 1,
      dryRun: true,
    });

    expect(summary.errors).toHaveLength(1);
    expect(summary.errors[0]).toContain("3 non-email subscribers were skipped");
  });
});
