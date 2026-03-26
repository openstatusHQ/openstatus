import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { createInstatusClient } from "./client";
import {
  MOCK_COMPONENTS,
  MOCK_INCIDENTS,
  MOCK_MAINTENANCES,
  MOCK_PAGES,
  MOCK_SUBSCRIBERS,
} from "./fixtures";

const originalFetch = globalThis.fetch;

function mockFetch(data: unknown, status = 200) {
  globalThis.fetch = mock(() =>
    Promise.resolve(
      new Response(JSON.stringify(data), {
        status,
        statusText: status === 200 ? "OK" : "Unauthorized",
        headers: { "Content-Type": "application/json" },
      }),
    ),
  ) as unknown as typeof globalThis.fetch;
}

function mockFetchPaginated(data: unknown, status = 200) {
  let callCount = 0;
  globalThis.fetch = mock(() => {
    callCount++;
    const body = callCount === 1 ? data : [];
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        statusText: status === 200 ? "OK" : "Unauthorized",
        headers: { "Content-Type": "application/json" },
      }),
    );
  }) as unknown as typeof globalThis.fetch;
}

describe("InstatusClient", () => {
  let client: ReturnType<typeof createInstatusClient>;

  beforeEach(() => {
    client = createInstatusClient("test-api-key");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("getPages returns parsed pages", async () => {
    mockFetch(MOCK_PAGES);
    const pages = await client.getPages();
    expect(pages).toEqual(MOCK_PAGES);
    expect(pages).toHaveLength(1);
    expect(pages[0].name).toBe("Acme Corp Status");
  });

  test("getComponents returns parsed components", async () => {
    mockFetchPaginated(MOCK_COMPONENTS);
    const components = await client.getComponents("in_page_001");
    expect(components).toEqual(MOCK_COMPONENTS);
    expect(components).toHaveLength(5);
  });

  test("getIncidents returns parsed incidents with updates", async () => {
    mockFetchPaginated(MOCK_INCIDENTS);
    const incidents = await client.getIncidents("in_page_001");
    expect(incidents).toEqual(MOCK_INCIDENTS);
    expect(incidents).toHaveLength(2);
    expect(incidents[0].updates).toHaveLength(4);
    expect(incidents[1].status).toBe("IDENTIFIED");
  });

  test("getMaintenances returns parsed maintenances", async () => {
    mockFetchPaginated(MOCK_MAINTENANCES);
    const maintenances = await client.getMaintenances("in_page_001");
    expect(maintenances).toEqual(MOCK_MAINTENANCES);
    expect(maintenances).toHaveLength(2);
    expect(maintenances[0].duration).toBe(240);
  });

  test("getSubscribers returns parsed subscribers", async () => {
    mockFetchPaginated(MOCK_SUBSCRIBERS);
    const subscribers = await client.getSubscribers("in_page_001");
    expect(subscribers).toEqual(MOCK_SUBSCRIBERS);
    expect(subscribers).toHaveLength(5);
    expect(subscribers[0].email).toBe("alice@acmecorp.com");
    expect(subscribers[2].phone).toBe("+15551234567");
  });

  test("throws on API error (401)", async () => {
    mockFetch({ error: "Unauthorized" }, 401);
    await expect(client.getPages()).rejects.toThrow(
      "Instatus API error: 401 Unauthorized for /v2/pages",
    );
  });

  test("getPage returns a single parsed page", async () => {
    mockFetch(MOCK_PAGES[0]);
    const singlePage = await client.getPage("in_page_001");
    expect(singlePage).toEqual(MOCK_PAGES[0]);
    expect(singlePage.id).toBe("in_page_001");
  });

  test("sends correct Bearer auth header", async () => {
    mockFetchPaginated(MOCK_PAGES);
    await client.getPages();
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof mock>;
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.instatus.com/v2/pages?page=1&per_page=100");
    expect((options.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-api-key",
    );
  });

  test("pagination handles response length exactly equal to per_page", async () => {
    // Create exactly per_page items so the loop makes one extra fetch
    const items = Array.from({ length: 100 }, (_, i) => ({
      ...MOCK_COMPONENTS[0],
      id: `comp_${i}`,
      name: `Component ${i}`,
    }));

    let callCount = 0;
    globalThis.fetch = mock(() => {
      callCount++;
      // First call: 100 items (= per_page), second call: empty array
      const body = callCount === 1 ? items : [];
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }) as unknown as typeof globalThis.fetch;

    const result = await client.getComponents("in_page_001");
    expect(result).toHaveLength(100);
    // Should have made 2 calls: first returns 100, second returns [] to terminate
    expect(callCount).toBe(2);
  });

  test("uses v1 for incidents and v2 for other endpoints", async () => {
    mockFetchPaginated(MOCK_INCIDENTS);
    await client.getIncidents("in_page_001");
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof mock>;
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/v1/in_page_001/incidents");
  });
});
