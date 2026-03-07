import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { createStatuspageClient } from "./client";
import {
  MOCK_COMPONENTS,
  MOCK_COMPONENT_GROUPS,
  MOCK_INCIDENTS,
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
  ) as typeof globalThis.fetch;
}

describe("StatuspageClient", () => {
  let client: ReturnType<typeof createStatuspageClient>;

  beforeEach(() => {
    client = createStatuspageClient("test-api-key");
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
    mockFetch(MOCK_COMPONENTS);
    const components = await client.getComponents("sp_page_001");
    expect(components).toEqual(MOCK_COMPONENTS);
    expect(components).toHaveLength(4);
    expect(components[2].status).toBe("degraded_performance");
  });

  test("getComponentGroups returns parsed groups", async () => {
    mockFetch(MOCK_COMPONENT_GROUPS);
    const groups = await client.getComponentGroups("sp_page_001");
    expect(groups).toEqual(MOCK_COMPONENT_GROUPS);
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe("Core Services");
    expect(groups[0].components).toEqual(["sp_comp_001", "sp_comp_002"]);
  });

  test("getIncidents returns parsed incidents with updates", async () => {
    mockFetch(MOCK_INCIDENTS);
    const incidents = await client.getIncidents("sp_page_001");
    expect(incidents).toEqual(MOCK_INCIDENTS);
    expect(incidents).toHaveLength(3);
    expect(incidents[0].incident_updates).toHaveLength(4);
    expect(incidents[0].postmortem_body).toBeTruthy();
    expect(incidents[1].status).toBe("identified");
    expect(incidents[2].scheduled_for).toBe("2024-06-20T02:00:00.000Z");
  });

  test("getSubscribers returns parsed subscribers", async () => {
    mockFetch(MOCK_SUBSCRIBERS);
    const subscribers = await client.getSubscribers("sp_page_001");
    expect(subscribers).toEqual(MOCK_SUBSCRIBERS);
    expect(subscribers).toHaveLength(5);
    expect(subscribers[0].mode).toBe("email");
    expect(subscribers[2].mode).toBe("webhook");
    expect(subscribers[3].mode).toBe("sms");
    expect(subscribers[4].mode).toBe("slack");
  });

  test("throws on API error (401)", async () => {
    mockFetch({ error: "Unauthorized" }, 401);
    await expect(client.getPages()).rejects.toThrow(
      "Statuspage API error: 401 Unauthorized for /pages",
    );
  });

  test("getPage returns a single parsed page", async () => {
    mockFetch(MOCK_PAGES[0]);
    const singlePage = await client.getPage("sp_page_001");
    expect(singlePage).toEqual(MOCK_PAGES[0]);
    expect(singlePage.id).toBe("sp_page_001");
    expect(singlePage.name).toBe("Acme Corp Status");
  });

  test("getPage calls correct URL path", async () => {
    mockFetch(MOCK_PAGES[0]);
    await client.getPage("sp_page_001");
    const fetchMock = globalThis.fetch as ReturnType<typeof mock>;
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.statuspage.io/v1/pages/sp_page_001");
  });

  test("getPage throws on non-200 response", async () => {
    mockFetch({ error: "Not Found" }, 404);
    await expect(client.getPage("nonexistent")).rejects.toThrow(
      "Statuspage API error: 404",
    );
  });

  test("getPage throws on schema mismatch", async () => {
    mockFetch({ id: 123, unexpected: true });
    await expect(client.getPage("sp_page_001")).rejects.toThrow();
  });

  test("getScheduledIncidents returns parsed scheduled incidents", async () => {
    const scheduled = MOCK_INCIDENTS.filter((i) => i.scheduled_for != null);
    mockFetch(scheduled);
    const incidents = await client.getScheduledIncidents("sp_page_001");
    expect(incidents).toEqual(scheduled);
    expect(incidents).toHaveLength(1);
    expect(incidents[0].scheduled_for).toBe("2024-06-20T02:00:00.000Z");
  });

  test("getScheduledIncidents calls correct URL path", async () => {
    mockFetch([]);
    await client.getScheduledIncidents("sp_page_001");
    const fetchMock = globalThis.fetch as ReturnType<typeof mock>;
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://api.statuspage.io/v1/pages/sp_page_001/incidents/scheduled",
    );
  });

  test("getScheduledIncidents throws on non-200 response", async () => {
    mockFetch({ error: "Forbidden" }, 403);
    await expect(client.getScheduledIncidents("sp_page_001")).rejects.toThrow(
      "Statuspage API error: 403",
    );
  });

  test("getScheduledIncidents throws on schema mismatch", async () => {
    mockFetch([{ bad: "data" }]);
    await expect(client.getScheduledIncidents("sp_page_001")).rejects.toThrow();
  });

  test("sends correct auth header", async () => {
    mockFetch(MOCK_PAGES);
    await client.getPages();
    const fetchMock = globalThis.fetch as ReturnType<typeof mock>;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.statuspage.io/v1/pages");
    expect((options.headers as Record<string, string>).Authorization).toBe(
      "OAuth test-api-key",
    );
  });
});
