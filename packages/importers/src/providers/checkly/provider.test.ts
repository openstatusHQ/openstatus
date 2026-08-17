import { expect } from "@std/expect";
import { afterEach, describe, test } from "@std/testing/bdd";
import { spy } from "@std/testing/mock";

import type { PhaseResult } from "../../types";
import {
  MOCK_CHECKS,
  MOCK_INCIDENTS,
  MOCK_MAINTENANCE_WINDOWS,
  MOCK_STATUS_PAGES,
} from "./fixtures";
import { createChecklyProvider } from "./provider";

const originalFetch = globalThis.fetch;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    statusText: status === 200 ? "OK" : "Unauthorized",
    headers: { "Content-Type": "application/json" },
  });
}

function mockFetchByPath(status = 200) {
  globalThis.fetch = spy((input: string | URL | Request) => {
    const url = String(input);
    let body: unknown = [];
    // incidents must be matched before the status-pages prefix
    if (url.includes("/v1/checks")) body = MOCK_CHECKS;
    else if (url.includes("/v1/status-pages/incidents"))
      body = { entries: MOCK_INCIDENTS, nextId: null };
    else if (url.includes("/v1/status-pages"))
      body = { entries: MOCK_STATUS_PAGES, nextId: null };
    else if (url.includes("/v1/maintenance-windows"))
      body = MOCK_MAINTENANCE_WINDOWS;
    return Promise.resolve(jsonResponse(body, status));
  }) as typeof globalThis.fetch;
}

function phase(phases: PhaseResult[], name: string): PhaseResult | undefined {
  return phases.find((p) => p.phase === name);
}

const baseConfig = {
  apiKey: "test-key",
  checklyAccountId: "test-account",
  workspaceId: 1,
};

describe("ChecklyProvider.validate", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("rejects a missing account id without calling the API", async () => {
    const provider = createChecklyProvider();
    const result = await provider.validate({
      apiKey: "k",
      checklyAccountId: "",
      workspaceId: 1,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("account ID");
  });

  test("accepts a working key", async () => {
    mockFetchByPath();
    const provider = createChecklyProvider();
    const result = await provider.validate(baseConfig);
    expect(result.valid).toBe(true);
  });

  test("maps 401 to a friendly error", async () => {
    mockFetchByPath(401);
    const provider = createChecklyProvider();
    const result = await provider.validate(baseConfig);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid Checkly API key");
  });
});

describe("ChecklyProvider.run", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("produces the six core phases", async () => {
    mockFetchByPath();
    const provider = createChecklyProvider();
    const summary = await provider.run(baseConfig);

    expect(summary.provider).toBe("checkly");
    expect(summary.phases.map((p) => p.phase)).toEqual([
      "monitors",
      "page",
      "componentGroups",
      "components",
      "incidents",
      "maintenances",
    ]);
  });

  test("skips unsupported check types, imports the rest", async () => {
    mockFetchByPath();
    const summary = await createChecklyProvider().run(baseConfig);
    const monitors = phase(summary.phases, "monitors");
    expect(monitors?.resources).toHaveLength(4);
    const created = monitors?.resources.filter((r) => r.status === "created");
    const skipped = monitors?.resources.filter((r) => r.status === "skipped");
    expect(created).toHaveLength(3);
    expect(skipped).toHaveLength(1);
    expect(skipped?.[0].error).toContain("BROWSER");
  });

  test("maps cards to groups and services to components", async () => {
    mockFetchByPath();
    const summary = await createChecklyProvider().run(baseConfig);
    expect(phase(summary.phases, "componentGroups")?.resources).toHaveLength(2);
    expect(phase(summary.phases, "components")?.resources).toHaveLength(3);
    expect(phase(summary.phases, "incidents")?.resources).toHaveLength(2);
    expect(phase(summary.phases, "maintenances")?.resources).toHaveLength(1);
  });

  test("only imports monitors when the status page id has no match", async () => {
    mockFetchByPath();
    const summary = await createChecklyProvider().run({
      ...baseConfig,
      checklyStatusPageId: "does-not-exist",
    });
    expect(summary.phases.map((p) => p.phase)).toEqual(["monitors"]);
  });
});
