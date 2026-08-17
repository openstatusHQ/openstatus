import { expect } from "@std/expect";
import { afterEach, beforeEach, describe, test } from "@std/testing/bdd";
import { assertSpyCalls, spy } from "@std/testing/mock";

import { createChecklyClient } from "./client";
import {
  MOCK_CHECKS,
  MOCK_INCIDENTS,
  MOCK_MAINTENANCE_WINDOWS,
  MOCK_STATUS_PAGES,
} from "./fixtures";

const originalFetch = globalThis.fetch;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    statusText: status === 200 ? "OK" : "Unauthorized",
    headers: { "Content-Type": "application/json" },
  });
}

// Returns each body in order; repeats the last one once exhausted.
function mockFetchSequence(bodies: unknown[], status = 200) {
  let call = 0;
  globalThis.fetch = spy(() => {
    const body = bodies[Math.min(call, bodies.length - 1)];
    call++;
    return Promise.resolve(jsonResponse(body, status));
  }) as typeof globalThis.fetch;
}

describe("ChecklyClient", () => {
  let client: ReturnType<typeof createChecklyClient>;

  beforeEach(() => {
    client = createChecklyClient("test-api-key", "test-account");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("getChecks returns parsed checks (bare array)", async () => {
    mockFetchSequence([MOCK_CHECKS]);
    const checks = await client.getChecks();
    expect(checks).toHaveLength(4);
    expect(checks[0].name).toBe("API Health Check");
    expect(checks[0].checkType).toBe("API");
  });

  test("getStatusPages returns parsed pages (cursor envelope)", async () => {
    mockFetchSequence([{ entries: MOCK_STATUS_PAGES, nextId: null }]);
    const pages = await client.getStatusPages();
    expect(pages).toHaveLength(1);
    expect(pages[0].cards).toHaveLength(2);
    expect(pages[0].cards[0].services).toHaveLength(2);
  });

  test("getIncidents returns parsed incidents (cursor envelope)", async () => {
    mockFetchSequence([{ entries: MOCK_INCIDENTS, nextId: null }]);
    const incidents = await client.getIncidents();
    expect(incidents).toHaveLength(2);
    expect(incidents[0].lastUpdateStatus).toBe("RESOLVED");
  });

  test("getMaintenanceWindows returns parsed windows (bare array)", async () => {
    mockFetchSequence([MOCK_MAINTENANCE_WINDOWS]);
    const windows = await client.getMaintenanceWindows();
    expect(windows).toHaveLength(1);
    expect(windows[0].name).toBe("Database upgrade");
  });

  // Live Checkly returns a numeric maintenance-window id; it must coerce to a
  // string so downstream sourceId matches the tRPC import contract.
  test("getMaintenanceWindows coerces a numeric id to a string", async () => {
    mockFetchSequence([[{ ...MOCK_MAINTENANCE_WINDOWS[0], id: 12345 }]]);
    const windows = await client.getMaintenanceWindows();
    expect(windows[0].id).toBe("12345");
  });

  test("sends both auth headers and correct path", async () => {
    mockFetchSequence([MOCK_CHECKS]);
    await client.getChecks();
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof spy>;
    assertSpyCalls(fetchMock, 1);
    const [url, options] = fetchMock.calls[0].args as [string, RequestInit];
    expect(url).toContain("https://api.checklyhq.com/v1/checks");
    const headers = options.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-api-key");
    expect(headers["X-Checkly-Account"]).toBe("test-account");
  });

  test("throws on API error (401)", async () => {
    mockFetchSequence([{ error: "unauthorized" }], 401);
    await expect(client.getChecks()).rejects.toThrow("Checkly API error: 401");
  });

  test("cursor pagination follows nextId until null", async () => {
    mockFetchSequence([
      { entries: [MOCK_STATUS_PAGES[0]], nextId: "cursor-2" },
      { entries: [MOCK_STATUS_PAGES[0]], nextId: null },
    ]);
    const pages = await client.getStatusPages();
    expect(pages).toHaveLength(2);
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof spy>;
    assertSpyCalls(fetchMock, 2);
    const secondUrl = fetchMock.calls[1].args[0] as string;
    expect(secondUrl).toContain("nextId=cursor-2");
  });

  test("page pagination requests next page on a full page", async () => {
    const fullPage = Array.from({ length: 100 }, (_, i) => ({
      ...MOCK_CHECKS[0],
      id: `chk_${i}`,
    }));
    mockFetchSequence([fullPage, []]);
    const checks = await client.getChecks();
    expect(checks).toHaveLength(100);
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof spy>;
    assertSpyCalls(fetchMock, 2);
    expect(fetchMock.calls[1].args[0] as string).toContain("page=2");
  });
});
