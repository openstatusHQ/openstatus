import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { createBetterstackClient } from "./client";
import {
  MOCK_INCIDENTS,
  MOCK_MONITORS,
  MOCK_MONITOR_GROUPS,
  MOCK_STATUS_PAGES,
  MOCK_STATUS_PAGE_RESOURCES,
  MOCK_STATUS_PAGE_SECTIONS,
  MOCK_STATUS_REPORTS,
  MOCK_STATUS_UPDATES_REPORT_001,
} from "./fixtures";

const originalFetch = globalThis.fetch;

function mockFetchPaginated(data: unknown[], status = 200) {
  let callCount = 0;
  globalThis.fetch = mock(() => {
    callCount++;
    const items = callCount === 1 ? data : [];
    const body = {
      data: items,
      pagination: {
        first: "https://uptime.betterstack.com/api/v2/test?page=1",
        last: "https://uptime.betterstack.com/api/v2/test?page=1",
        prev: null,
        next: null,
      },
    };
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        statusText: status === 200 ? "OK" : "Unauthorized",
        headers: { "Content-Type": "application/json" },
      }),
    );
  }) as typeof globalThis.fetch;
}

function mockFetchError(status: number, statusText: string) {
  globalThis.fetch = mock(() =>
    Promise.resolve(
      new Response(JSON.stringify({ error: statusText }), {
        status,
        statusText,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  ) as typeof globalThis.fetch;
}

describe("BetterstackClient", () => {
  let client: ReturnType<typeof createBetterstackClient>;

  beforeEach(() => {
    client = createBetterstackClient("test-api-key");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("getMonitors returns parsed monitors", async () => {
    mockFetchPaginated(MOCK_MONITORS);
    const monitors = await client.getMonitors();
    expect(monitors).toEqual(MOCK_MONITORS);
    expect(monitors).toHaveLength(3);
    expect(monitors[0].attributes.pronounceable_name).toBe("API Health Check");
  });

  test("getMonitorGroups returns parsed groups", async () => {
    mockFetchPaginated(MOCK_MONITOR_GROUPS);
    const groups = await client.getMonitorGroups();
    expect(groups).toEqual(MOCK_MONITOR_GROUPS);
    expect(groups).toHaveLength(1);
    expect(groups[0].attributes.name).toBe("Core Services");
  });

  test("getStatusPages returns parsed status pages", async () => {
    mockFetchPaginated(MOCK_STATUS_PAGES);
    const pages = await client.getStatusPages();
    expect(pages).toEqual(MOCK_STATUS_PAGES);
    expect(pages).toHaveLength(1);
    expect(pages[0].attributes.company_name).toBe("Acme Corp");
  });

  test("getStatusPageSections returns parsed sections", async () => {
    mockFetchPaginated(MOCK_STATUS_PAGE_SECTIONS);
    const sections = await client.getStatusPageSections("bs_sp_001");
    expect(sections).toEqual(MOCK_STATUS_PAGE_SECTIONS);
    expect(sections).toHaveLength(2);
    expect(sections[0].attributes.name).toBe("API Services");
  });

  test("getStatusPageResources returns parsed resources", async () => {
    mockFetchPaginated(MOCK_STATUS_PAGE_RESOURCES);
    const resources = await client.getStatusPageResources("bs_sp_001");
    expect(resources).toEqual(MOCK_STATUS_PAGE_RESOURCES);
    expect(resources).toHaveLength(3);
    expect(resources[0].attributes.public_name).toBe("API Gateway");
  });

  test("getStatusPageReports returns parsed reports", async () => {
    mockFetchPaginated(MOCK_STATUS_REPORTS);
    const reports = await client.getStatusPageReports("bs_sp_001");
    expect(reports).toEqual(MOCK_STATUS_REPORTS);
    expect(reports).toHaveLength(3);
    expect(reports[0].attributes.title).toBe(
      "API Gateway Elevated Error Rates",
    );
    expect(reports[2].attributes.report_type).toBe("maintenance");
  });

  test("getStatusReportUpdates returns parsed updates", async () => {
    mockFetchPaginated(MOCK_STATUS_UPDATES_REPORT_001);
    const updates = await client.getStatusReportUpdates(
      "bs_sp_001",
      "bs_report_001",
    );
    expect(updates).toEqual(MOCK_STATUS_UPDATES_REPORT_001);
    expect(updates).toHaveLength(3);
    expect(updates[0].attributes.message).toContain("investigating");
  });

  test("getIncidents returns parsed incidents", async () => {
    mockFetchPaginated(MOCK_INCIDENTS);
    const incidents = await client.getIncidents();
    expect(incidents).toEqual(MOCK_INCIDENTS);
    expect(incidents).toHaveLength(3);
    expect(incidents[0].attributes.status).toBe("resolved");
    expect(incidents[1].attributes.acknowledged_at).not.toBeNull();
    expect(incidents[2].attributes.name).toBeNull();
  });

  test("throws on API error (401)", async () => {
    mockFetchError(401, "Unauthorized");
    await expect(client.getMonitors()).rejects.toThrow(
      "BetterStack API error: 401 Unauthorized",
    );
  });

  test("sends correct auth header", async () => {
    mockFetchPaginated(MOCK_MONITORS);
    await client.getMonitors();
    const fetchMock = globalThis.fetch as ReturnType<typeof mock>;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://uptime.betterstack.com/api/v2/monitors");
    expect((options.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-api-key",
    );
  });

  test("follows pagination.next for multiple pages", async () => {
    let callCount = 0;
    globalThis.fetch = mock(() => {
      callCount++;
      const body =
        callCount === 1
          ? {
              data: [MOCK_MONITORS[0]],
              pagination: {
                first: null,
                last: null,
                prev: null,
                next: "https://uptime.betterstack.com/api/v2/monitors?page=2",
              },
            }
          : {
              data: [MOCK_MONITORS[1]],
              pagination: {
                first: null,
                last: null,
                prev: null,
                next: null,
              },
            };
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          statusText: "OK",
          headers: { "Content-Type": "application/json" },
        }),
      );
    }) as typeof globalThis.fetch;

    const monitors = await client.getMonitors();
    expect(monitors).toHaveLength(2);
    expect(monitors[0].id).toBe("bs_mon_001");
    expect(monitors[1].id).toBe("bs_mon_002");
    expect(callCount).toBe(2);
  });
});
