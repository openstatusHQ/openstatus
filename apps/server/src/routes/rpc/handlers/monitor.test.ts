import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { db, eq } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";

import { app } from "@/index";

/**
 * Helper to make ConnectRPC requests using the Connect protocol (JSON).
 * Connect uses POST with JSON body at /rpc/<service>/<method>
 */
async function connectRequest(
  method: string,
  body: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) {
  return app.request(`/rpc/openstatus.monitor.v1.MonitorService/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const TEST_PREFIX = "rpc-monitor-test";
let testHttpMonitorId: number;
let testTcpMonitorId: number;
let testDnsMonitorId: number;
let testMonitorToDeleteId: number;

beforeAll(async () => {
  // Clean up any existing test data
  await db.delete(monitor).where(eq(monitor.name, `${TEST_PREFIX}-http`));
  await db.delete(monitor).where(eq(monitor.name, `${TEST_PREFIX}-tcp`));
  await db.delete(monitor).where(eq(monitor.name, `${TEST_PREFIX}-dns`));
  await db.delete(monitor).where(eq(monitor.name, `${TEST_PREFIX}-to-delete`));

  // Create test HTTP monitor
  const httpMon = await db
    .insert(monitor)
    .values({
      workspaceId: 1,
      name: `${TEST_PREFIX}-http`,
      url: "https://example.com",
      periodicity: "1m",
      active: true,
      regions: "ams",
      jobType: "http",
      method: "GET",
      timeout: 30000,
      headers: JSON.stringify([{ key: "X-Test", value: "test-value" }]),
      assertions: JSON.stringify([
        { type: "status", compare: "eq", target: 200 },
        { type: "textBody", compare: "contains", target: "success" },
        {
          type: "header",
          compare: "eq",
          target: "application/json",
          key: "content-type",
        },
      ]),
    })
    .returning()
    .get();
  testHttpMonitorId = httpMon.id;

  // Create test TCP monitor
  const tcpMon = await db
    .insert(monitor)
    .values({
      workspaceId: 1,
      name: `${TEST_PREFIX}-tcp`,
      url: "tcp://example.com:443",
      periodicity: "5m",
      active: true,
      regions: "ams",
      jobType: "tcp",
      timeout: 10000,
    })
    .returning()
    .get();
  testTcpMonitorId = tcpMon.id;

  // Create test DNS monitor
  const dnsMon = await db
    .insert(monitor)
    .values({
      workspaceId: 1,
      name: `${TEST_PREFIX}-dns`,
      url: "example.com",
      periodicity: "10m",
      active: true,
      regions: "ams",
      jobType: "dns",
      timeout: 5000,
      assertions: JSON.stringify([
        { type: "dns", compare: "eq", target: "93.184.216.34", record: "A" },
      ]),
    })
    .returning()
    .get();
  testDnsMonitorId = dnsMon.id;

  // Create monitor to be deleted
  const deleteMon = await db
    .insert(monitor)
    .values({
      workspaceId: 1,
      name: `${TEST_PREFIX}-to-delete`,
      url: "https://to-delete.example.com",
      periodicity: "1m",
      active: true,
      regions: "ams",
      jobType: "http",
    })
    .returning()
    .get();
  testMonitorToDeleteId = deleteMon.id;
});

afterAll(async () => {
  // Clean up test data
  await db.delete(monitor).where(eq(monitor.name, `${TEST_PREFIX}-http`));
  await db.delete(monitor).where(eq(monitor.name, `${TEST_PREFIX}-tcp`));
  await db.delete(monitor).where(eq(monitor.name, `${TEST_PREFIX}-dns`));
  await db.delete(monitor).where(eq(monitor.name, `${TEST_PREFIX}-to-delete`));
});

describe("MonitorService.ListMonitors", () => {
  test("returns monitors for authenticated workspace", async () => {
    const res = await connectRequest(
      "ListMonitors",
      {},
      {
        "x-openstatus-key": "1",
      },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("httpMonitors");
    expect(data).toHaveProperty("tcpMonitors");
    expect(data).toHaveProperty("dnsMonitors");
    expect(Array.isArray(data.httpMonitors)).toBe(true);
    expect(Array.isArray(data.tcpMonitors)).toBe(true);
    expect(Array.isArray(data.dnsMonitors)).toBe(true);
  });

  test("returns HTTP monitors with correct structure", async () => {
    const res = await connectRequest(
      "ListMonitors",
      { pageSize: 100 }, // Request more to ensure we get our test monitors
      {
        "x-openstatus-key": "1",
      },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    // Proto3 may omit empty arrays
    const httpMonitors = data.httpMonitors || [];
    const httpMon = httpMonitors.find(
      (m: { id: string }) => m.id === String(testHttpMonitorId),
    );

    expect(httpMon).toBeDefined();
    expect(httpMon.url).toBe("https://example.com");
    expect(httpMon.periodicity).toBe("PERIODICITY_1M");
    expect(httpMon.method).toBe("HTTP_METHOD_GET");
    expect(httpMon.headers).toBeDefined();
    expect(httpMon.statusCodeAssertions).toBeDefined();
    expect(httpMon.bodyAssertions).toBeDefined();
    expect(httpMon.headerAssertions).toBeDefined();
  });

  test("returns TCP monitors with correct structure", async () => {
    const res = await connectRequest(
      "ListMonitors",
      { pageSize: 100 }, // Request more to ensure we get our test monitors
      {
        "x-openstatus-key": "1",
      },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    // Proto3 may omit empty arrays
    const tcpMonitors = data.tcpMonitors || [];
    const tcpMon = tcpMonitors.find(
      (m: { id: string }) => m.id === String(testTcpMonitorId),
    );

    expect(tcpMon).toBeDefined();
    expect(tcpMon.uri).toBe("tcp://example.com:443");
    expect(tcpMon.periodicity).toBe("PERIODICITY_5M");
  });

  test("returns DNS monitors with correct structure", async () => {
    const res = await connectRequest(
      "ListMonitors",
      { pageSize: 100 }, // Request more to ensure we get our test monitors
      {
        "x-openstatus-key": "1",
      },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    // Proto3 may omit empty arrays
    const dnsMonitors = data.dnsMonitors || [];
    const dnsMon = dnsMonitors.find(
      (m: { id: string }) => m.id === String(testDnsMonitorId),
    );

    expect(dnsMon).toBeDefined();
    expect(dnsMon.uri).toBe("example.com");
    expect(dnsMon.periodicity).toBe("PERIODICITY_10M");
    expect(dnsMon.recordAssertions).toBeDefined();
  });

  test("returns 401 when no auth key provided", async () => {
    const res = await connectRequest("ListMonitors", {});

    expect(res.status).toBe(401);
  });

  test("respects page_size parameter", async () => {
    const res = await connectRequest(
      "ListMonitors",
      { pageSize: 2 },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    // Proto3 may omit empty repeated fields from JSON output
    const totalMonitors =
      (data.httpMonitors?.length || 0) +
      (data.tcpMonitors?.length || 0) +
      (data.dnsMonitors?.length || 0);

    // Should return at most 2 monitors total
    expect(totalMonitors).toBeLessThanOrEqual(2);
  });

  test("returns nextPageToken for pagination", async () => {
    const res = await connectRequest(
      "ListMonitors",
      { pageSize: 1 },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    // If there's more than 1 monitor, should have a nextPageToken
    expect(data).toHaveProperty("nextPageToken");
  });

  test("uses pageToken for pagination", async () => {
    // First page
    const res1 = await connectRequest(
      "ListMonitors",
      { pageSize: 1 },
      { "x-openstatus-key": "1" },
    );

    expect(res1.status).toBe(200);
    const data1 = await res1.json();

    if (data1.nextPageToken) {
      // Second page
      const res2 = await connectRequest(
        "ListMonitors",
        { pageSize: 1, pageToken: data1.nextPageToken },
        { "x-openstatus-key": "1" },
      );

      expect(res2.status).toBe(200);
      const data2 = await res2.json();

      // Proto3 may omit empty repeated fields from JSON output
      // The monitors from second page should be different from first page
      const firstPageIds = [
        ...(data1.httpMonitors || []).map((m: { id: string }) => m.id),
        ...(data1.tcpMonitors || []).map((m: { id: string }) => m.id),
        ...(data1.dnsMonitors || []).map((m: { id: string }) => m.id),
      ];
      const secondPageIds = [
        ...(data2.httpMonitors || []).map((m: { id: string }) => m.id),
        ...(data2.tcpMonitors || []).map((m: { id: string }) => m.id),
        ...(data2.dnsMonitors || []).map((m: { id: string }) => m.id),
      ];

      // Should have no overlap
      const overlap = firstPageIds.filter((id: string) =>
        secondPageIds.includes(id),
      );
      expect(overlap.length).toBe(0);
    }
  });

  test("only returns monitors for the authenticated workspace", async () => {
    // Create a monitor for workspace 2
    const otherWorkspaceMon = await db
      .insert(monitor)
      .values({
        workspaceId: 2,
        name: `${TEST_PREFIX}-other-workspace`,
        url: "https://other-workspace.example.com",
        periodicity: "1m",
        active: true,
        regions: "ams",
        jobType: "http",
      })
      .returning()
      .get();

    try {
      const res = await connectRequest(
        "ListMonitors",
        { pageSize: 100 },
        {
          "x-openstatus-key": "1",
        },
      );

      expect(res.status).toBe(200);

      const data = await res.json();
      // Proto3 may omit empty arrays
      const allMonitorIds = [
        ...(data.httpMonitors || []).map((m: { id: string }) => m.id),
        ...(data.tcpMonitors || []).map((m: { id: string }) => m.id),
        ...(data.dnsMonitors || []).map((m: { id: string }) => m.id),
      ];

      // Should not contain the other workspace's monitor
      expect(allMonitorIds).not.toContain(String(otherWorkspaceMon.id));
    } finally {
      await db.delete(monitor).where(eq(monitor.id, otherWorkspaceMon.id));
    }
  });
});

describe("MonitorService.DeleteMonitor", () => {
  test("successfully deletes existing monitor", async () => {
    const res = await connectRequest(
      "DeleteMonitor",
      { id: String(testMonitorToDeleteId) },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);

    // Verify the monitor was soft-deleted
    const deletedMon = await db
      .select()
      .from(monitor)
      .where(eq(monitor.id, testMonitorToDeleteId))
      .get();

    expect(deletedMon).toBeDefined();
    expect(deletedMon?.deletedAt).not.toBeNull();
    expect(deletedMon?.active).toBe(false);
  });

  test("returns 404 for non-existent monitor", async () => {
    const res = await connectRequest(
      "DeleteMonitor",
      { id: "99999" },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(404);
  });

  test("returns 401 when no auth key provided", async () => {
    const res = await connectRequest("DeleteMonitor", { id: "1" });

    expect(res.status).toBe(401);
  });

  test("cannot delete monitor from another workspace", async () => {
    // Create a monitor for workspace 2
    const otherWorkspaceMon = await db
      .insert(monitor)
      .values({
        workspaceId: 2,
        name: `${TEST_PREFIX}-delete-other-ws`,
        url: "https://other-ws-delete.example.com",
        periodicity: "1m",
        active: true,
        regions: "ams",
        jobType: "http",
      })
      .returning()
      .get();

    try {
      // Try to delete with workspace 1's key
      const res = await connectRequest(
        "DeleteMonitor",
        { id: String(otherWorkspaceMon.id) },
        { "x-openstatus-key": "1" },
      );

      // Should return 404 (not found in this workspace)
      expect(res.status).toBe(404);

      // Verify the monitor still exists
      const stillExists = await db
        .select()
        .from(monitor)
        .where(eq(monitor.id, otherWorkspaceMon.id))
        .get();

      expect(stillExists).toBeDefined();
      expect(stillExists?.deletedAt).toBeNull();
    } finally {
      await db.delete(monitor).where(eq(monitor.id, otherWorkspaceMon.id));
    }
  });
});

describe("MonitorService.CreateHTTPMonitor", () => {
  test("successfully creates HTTP monitor", async () => {
    const res = await connectRequest(
      "CreateHTTPMonitor",
      {
        monitor: {
          name: "test-create-http",
          url: "https://create-test.example.com",
          periodicity: "PERIODICITY_5M",
          method: "HTTP_METHOD_POST",
          timeout: "30000",
          followRedirects: true,
          headers: [{ key: "X-Custom", value: "test" }],
          statusCodeAssertions: [{ target: "200", comparator: 1 }],
        },
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.monitor).toBeDefined();
    expect(data.monitor.url).toBe("https://create-test.example.com");
    expect(data.monitor.periodicity).toBe("PERIODICITY_5M");
    expect(data.monitor.method).toBe("HTTP_METHOD_POST");

    // Clean up
    if (data.monitor.id) {
      await db.delete(monitor).where(eq(monitor.id, Number(data.monitor.id)));
    }
  });

  test("returns error when monitor is missing", async () => {
    const res = await connectRequest(
      "CreateHTTPMonitor",
      {},
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
  });

  test("returns 401 when no auth key provided", async () => {
    const res = await connectRequest("CreateHTTPMonitor", {
      monitor: { url: "https://test.example.com" },
    });

    expect(res.status).toBe(401);
  });
});

describe("MonitorService.CreateTCPMonitor", () => {
  test("successfully creates TCP monitor", async () => {
    const res = await connectRequest(
      "CreateTCPMonitor",
      {
        monitor: {
          name: "test-create-tcp",
          uri: "tcp://create-tcp-test.example.com:8080",
          periodicity: "PERIODICITY_10M",
          timeout: "15000",
        },
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.monitor).toBeDefined();
    expect(data.monitor.uri).toBe("tcp://create-tcp-test.example.com:8080");
    expect(data.monitor.periodicity).toBe("PERIODICITY_10M");

    // Clean up
    if (data.monitor.id) {
      await db.delete(monitor).where(eq(monitor.id, Number(data.monitor.id)));
    }
  });

  test("returns error when monitor is missing", async () => {
    const res = await connectRequest(
      "CreateTCPMonitor",
      {},
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
  });
});

describe("MonitorService.CreateDNSMonitor", () => {
  test("successfully creates DNS monitor", async () => {
    const res = await connectRequest(
      "CreateDNSMonitor",
      {
        monitor: {
          name: "test-create-dns",
          uri: "create-dns-test.example.com",
          periodicity: "PERIODICITY_30M",
          timeout: "5000",
          recordAssertions: [{ record: "A", target: "1.2.3.4", comparator: 1 }],
        },
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.monitor).toBeDefined();
    expect(data.monitor.uri).toBe("create-dns-test.example.com");
    expect(data.monitor.periodicity).toBe("PERIODICITY_30M");

    // Clean up
    if (data.monitor.id) {
      await db.delete(monitor).where(eq(monitor.id, Number(data.monitor.id)));
    }
  });

  test("returns error when monitor is missing", async () => {
    const res = await connectRequest(
      "CreateDNSMonitor",
      {},
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
  });
});

describe("MonitorService.TriggerMonitor", () => {
  test("returns 404 for non-existent monitor", async () => {
    const res = await connectRequest(
      "TriggerMonitor",
      { id: "99999" },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(404);
  });

  test("returns 401 when no auth key provided", async () => {
    const res = await connectRequest("TriggerMonitor", { id: "1" });

    expect(res.status).toBe(401);
  });
});

describe("MonitorService - Authentication", () => {
  test("invalid API key returns 401", async () => {
    const res = await connectRequest(
      "ListMonitors",
      {},
      {
        "x-openstatus-key": "invalid-key",
      },
    );

    expect(res.status).toBe(401);
  });
});

describe("MonitorService - Validation", () => {
  test("returns error when name is missing for HTTP monitor", async () => {
    const res = await connectRequest(
      "CreateHTTPMonitor",
      {
        monitor: {
          url: "https://test.example.com",
          periodicity: "PERIODICITY_5M",
        },
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toContain("name");
  });

  test("returns error when name is empty for HTTP monitor", async () => {
    const res = await connectRequest(
      "CreateHTTPMonitor",
      {
        monitor: {
          name: "",
          url: "https://test.example.com",
          periodicity: "PERIODICITY_5M",
        },
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toContain("name");
  });

  test("returns error when URL is missing for HTTP monitor", async () => {
    const res = await connectRequest(
      "CreateHTTPMonitor",
      {
        monitor: {
          name: "test-monitor",
          periodicity: "PERIODICITY_5M",
        },
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    // protovalidate uses lowercase "url" in the error message
    expect(data.message.toLowerCase()).toContain("url");
  });

  test("returns error when URI is missing for TCP monitor", async () => {
    const res = await connectRequest(
      "CreateTCPMonitor",
      {
        monitor: {
          name: "test-tcp-monitor",
          periodicity: "PERIODICITY_5M",
        },
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    // protovalidate uses lowercase "uri" in the error message
    expect(data.message.toLowerCase()).toContain("uri");
  });

  test("returns error when URI is missing for DNS monitor", async () => {
    const res = await connectRequest(
      "CreateDNSMonitor",
      {
        monitor: {
          name: "test-dns-monitor",
          periodicity: "PERIODICITY_5M",
        },
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    // protovalidate uses lowercase "uri" in the error message
    expect(data.message.toLowerCase()).toContain("uri");
  });

  test("invalid region strings are filtered out", async () => {
    const res = await connectRequest(
      "CreateHTTPMonitor",
      {
        monitor: {
          name: "test-invalid-regions",
          url: "https://test.example.com",
          periodicity: "PERIODICITY_5M",
          method: "HTTP_METHOD_GET",
          regions: ["invalid-region", "another-invalid"],
        },
      },
      { "x-openstatus-key": "1" },
    );

    // Invalid region strings are parsed as UNSPECIFIED and filtered out
    // Monitor is created with empty regions
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.monitor).toBeDefined();
    // Proto3 may omit empty arrays
    expect(data.monitor.regions || []).toEqual([]);

    // Clean up
    if (data.monitor.id) {
      await db.delete(monitor).where(eq(monitor.id, Number(data.monitor.id)));
    }
  });

  test("accepts valid regions", async () => {
    const res = await connectRequest(
      "CreateHTTPMonitor",
      {
        monitor: {
          name: "test-valid-regions",
          url: "https://test-valid-regions.example.com",
          periodicity: "PERIODICITY_5M",
          method: "HTTP_METHOD_GET",
          regions: ["REGION_AMS", "REGION_IAD", "REGION_SIN"],
        },
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.monitor).toBeDefined();
    expect(data.monitor.regions).toEqual(["REGION_AMS", "REGION_IAD", "REGION_SIN"]);

    // Clean up
    if (data.monitor.id) {
      await db.delete(monitor).where(eq(monitor.id, Number(data.monitor.id)));
    }
  });
});

describe("MonitorService - Assertions Round-trip", () => {
  test("HTTP assertions are correctly stored and retrieved", async () => {
    const createRes = await connectRequest(
      "CreateHTTPMonitor",
      {
        monitor: {
          name: "test-assertions-roundtrip",
          url: "https://test-assertions.example.com",
          periodicity: "PERIODICITY_5M",
          method: "HTTP_METHOD_GET",
          statusCodeAssertions: [
            { target: "200", comparator: 1 },
            { target: "201", comparator: 1 },
          ],
          bodyAssertions: [{ target: "success", comparator: 3 }],
          headerAssertions: [
            { key: "content-type", target: "application/json", comparator: 1 },
          ],
        },
      },
      { "x-openstatus-key": "1" },
    );

    expect(createRes.status).toBe(200);
    const createData = await createRes.json();
    const monitorId = createData.monitor.id;

    try {
      // List monitors to verify assertions are retrieved correctly
      const listRes = await connectRequest(
        "ListMonitors",
        { pageSize: 100 },
        { "x-openstatus-key": "1" },
      );

      expect(listRes.status).toBe(200);
      const listData = await listRes.json();

      // Proto3 may omit empty arrays
      const httpMonitors = listData.httpMonitors || [];
      const foundMonitor = httpMonitors.find(
        (m: { id: string }) => m.id === monitorId,
      );

      expect(foundMonitor).toBeDefined();
      expect(foundMonitor.statusCodeAssertions).toHaveLength(2);
      expect(foundMonitor.bodyAssertions).toHaveLength(1);
      expect(foundMonitor.headerAssertions).toHaveLength(1);
      expect(foundMonitor.headerAssertions[0].key).toBe("content-type");
    } finally {
      // Clean up
      await db.delete(monitor).where(eq(monitor.id, Number(monitorId)));
    }
  });

  test("DNS record assertions are correctly stored and retrieved", async () => {
    const createRes = await connectRequest(
      "CreateDNSMonitor",
      {
        monitor: {
          name: "test-dns-assertions",
          uri: "test-dns-assertions.example.com",
          periodicity: "PERIODICITY_5M",
          recordAssertions: [
            { record: "A", target: "93.184.216.34", comparator: 1 },
            { record: "AAAA", target: "2606:2800:220:1::", comparator: 1 },
          ],
        },
      },
      { "x-openstatus-key": "1" },
    );

    expect(createRes.status).toBe(200);
    const createData = await createRes.json();
    const monitorId = createData.monitor.id;

    try {
      const listRes = await connectRequest(
        "ListMonitors",
        { pageSize: 100 },
        { "x-openstatus-key": "1" },
      );

      expect(listRes.status).toBe(200);
      const listData = await listRes.json();

      // Proto3 may omit empty arrays
      const dnsMonitors = listData.dnsMonitors || [];
      const foundMonitor = dnsMonitors.find(
        (m: { id: string }) => m.id === monitorId,
      );

      expect(foundMonitor).toBeDefined();
      expect(foundMonitor.recordAssertions).toHaveLength(2);
      expect(foundMonitor.recordAssertions[0].record).toBe("A");
      expect(foundMonitor.recordAssertions[1].record).toBe("AAAA");
    } finally {
      await db.delete(monitor).where(eq(monitor.id, Number(monitorId)));
    }
  });
});

describe("MonitorService - OpenTelemetry Configuration", () => {
  test("OpenTelemetry config is correctly stored and retrieved", async () => {
    const createRes = await connectRequest(
      "CreateHTTPMonitor",
      {
        monitor: {
          name: "test-otel-config",
          url: "https://test-otel.example.com",
          periodicity: "PERIODICITY_5M",
          method: "HTTP_METHOD_GET",
          openTelemetry: {
            endpoint: "https://otel-collector.example.com/v1/traces",
            headers: [
              { key: "Authorization", value: "Bearer test-token" },
              { key: "X-Custom-Header", value: "custom-value" },
            ],
          },
        },
      },
      { "x-openstatus-key": "1" },
    );

    expect(createRes.status).toBe(200);
    const createData = await createRes.json();
    const monitorId = createData.monitor.id;

    try {
      const listRes = await connectRequest(
        "ListMonitors",
        { pageSize: 100 },
        { "x-openstatus-key": "1" },
      );

      expect(listRes.status).toBe(200);
      const listData = await listRes.json();

      // Proto3 may omit empty arrays
      const httpMonitors = listData.httpMonitors || [];
      const foundMonitor = httpMonitors.find(
        (m: { id: string }) => m.id === monitorId,
      );

      expect(foundMonitor).toBeDefined();
      expect(foundMonitor.openTelemetry).toBeDefined();
      expect(foundMonitor.openTelemetry.endpoint).toBe(
        "https://otel-collector.example.com/v1/traces",
      );
      expect(foundMonitor.openTelemetry.headers).toHaveLength(2);
      expect(foundMonitor.openTelemetry.headers[0].key).toBe("Authorization");
    } finally {
      await db.delete(monitor).where(eq(monitor.id, Number(monitorId)));
    }
  });

  test("Monitor without OpenTelemetry config works correctly", async () => {
    const createRes = await connectRequest(
      "CreateHTTPMonitor",
      {
        monitor: {
          name: "test-no-otel",
          url: "https://test-no-otel.example.com",
          periodicity: "PERIODICITY_5M",
          method: "HTTP_METHOD_GET",
        },
      },
      { "x-openstatus-key": "1" },
    );

    expect(createRes.status).toBe(200);
    const createData = await createRes.json();
    const monitorId = createData.monitor.id;

    try {
      const listRes = await connectRequest(
        "ListMonitors",
        { pageSize: 100 },
        { "x-openstatus-key": "1" },
      );

      const listData = await listRes.json();
      // Proto3 may omit empty arrays
      const httpMonitors = listData.httpMonitors || [];
      const foundMonitor = httpMonitors.find(
        (m: { id: string }) => m.id === monitorId,
      );

      expect(foundMonitor).toBeDefined();
      // OpenTelemetry should be undefined when not configured
      expect(foundMonitor.openTelemetry).toBeUndefined();
    } finally {
      await db.delete(monitor).where(eq(monitor.id, Number(monitorId)));
    }
  });
});

describe("MonitorService - Default Values", () => {
  test("HTTP monitor uses default values when not specified", async () => {
    const createRes = await connectRequest(
      "CreateHTTPMonitor",
      {
        monitor: {
          name: "test-defaults",
          url: "https://test-defaults.example.com",
          periodicity: "PERIODICITY_5M",
          method: "HTTP_METHOD_GET",
        },
      },
      { "x-openstatus-key": "1" },
    );

    expect(createRes.status).toBe(200);
    const createData = await createRes.json();
    const monitorId = createData.monitor.id;

    try {
      expect(createData.monitor.timeout).toBe("45000");
      expect(createData.monitor.retry).toBe("3");
      // In proto3, boolean defaults to false and is often omitted from JSON serialization
      // followRedirects defaults to the proto3 default (false), not server-side default
      expect(createData.monitor.followRedirects ?? false).toBe(false);
      expect(createData.monitor.active ?? false).toBe(false);
      expect(createData.monitor.public ?? false).toBe(false);
      expect(createData.monitor.method).toBe("HTTP_METHOD_GET");
    } finally {
      await db.delete(monitor).where(eq(monitor.id, Number(monitorId)));
    }
  });
});

describe("MonitorService - Limits", () => {
  // Workspace 2 has free plan with limited periodicity (10m, 30m, 1h) and max 6 regions
  const FREE_PLAN_KEY = "2";

  test("returns error when periodicity is not allowed by plan", async () => {
    // Free plan only allows 10m, 30m, 1h - PERIODICITY_30S is not allowed
    const res = await connectRequest(
      "CreateHTTPMonitor",
      {
        monitor: {
          name: "test-periodicity-limit",
          url: "https://test-periodicity.example.com",
          periodicity: "PERIODICITY_30S",
          method: "HTTP_METHOD_GET",
        },
      },
      { "x-openstatus-key": FREE_PLAN_KEY },
    );

    // Should return 403 (PermissionDenied maps to 403 in Connect)
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.message).toContain("periodicity");
  });

  test("returns error when too many regions specified", async () => {
    // Free plan has max-regions: 6, try to use 8 regions
    const res = await connectRequest(
      "CreateHTTPMonitor",
      {
        monitor: {
          name: "test-region-limit",
          url: "https://test-region-limit.example.com",
          periodicity: "PERIODICITY_10M",
          method: "HTTP_METHOD_GET",
          regions: [
            "REGION_AMS",
            "REGION_IAD",
            "REGION_SIN",
            "REGION_LHR",
            "REGION_SYD",
            "REGION_NRT",
            "REGION_FRA",
            "REGION_GRU",
          ],
        },
      },
      { "x-openstatus-key": FREE_PLAN_KEY },
    );

    // Should return 403 (PermissionDenied maps to 403 in Connect)
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.message).toContain("region");
  });

  test("allows valid periodicity for plan", async () => {
    // PERIODICITY_10M is allowed on free plan
    const res = await connectRequest(
      "CreateHTTPMonitor",
      {
        monitor: {
          name: "test-valid-periodicity",
          url: "https://test-valid-periodicity.example.com",
          periodicity: "PERIODICITY_10M",
          method: "HTTP_METHOD_GET",
        },
      },
      { "x-openstatus-key": FREE_PLAN_KEY },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.monitor).toBeDefined();

    // Clean up
    if (data.monitor.id) {
      await db.delete(monitor).where(eq(monitor.id, Number(data.monitor.id)));
    }
  });

  test("TCP monitor respects periodicity limits", async () => {
    const res = await connectRequest(
      "CreateTCPMonitor",
      {
        monitor: {
          name: "test-tcp-periodicity-limit",
          uri: "tcp://test-periodicity.example.com:443",
          periodicity: "PERIODICITY_30S",
        },
      },
      { "x-openstatus-key": FREE_PLAN_KEY },
    );

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.message).toContain("periodicity");
  });

  test("DNS monitor respects periodicity limits", async () => {
    const res = await connectRequest(
      "CreateDNSMonitor",
      {
        monitor: {
          name: "test-dns-periodicity-limit",
          uri: "test-periodicity.example.com",
          periodicity: "PERIODICITY_30S",
        },
      },
      { "x-openstatus-key": FREE_PLAN_KEY },
    );

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.message).toContain("periodicity");
  });
});

describe("MonitorService - Status Field", () => {
  test("HTTP monitor includes status field in response", async () => {
    const res = await connectRequest(
      "ListMonitors",
      { pageSize: 100 },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    const httpMonitors = data.httpMonitors || [];
    const httpMon = httpMonitors.find(
      (m: { id: string }) => m.id === String(testHttpMonitorId),
    );

    expect(httpMon).toBeDefined();
    // Status should be present and be a valid MonitorStatus enum value
    expect(httpMon.status).toBeDefined();
    expect(["MONITOR_STATUS_ACTIVE", "MONITOR_STATUS_DEGRADED", "MONITOR_STATUS_ERROR", "MONITOR_STATUS_UNSPECIFIED"]).toContain(httpMon.status);
  });

  test("TCP monitor includes status field in response", async () => {
    const res = await connectRequest(
      "ListMonitors",
      { pageSize: 100 },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    const tcpMonitors = data.tcpMonitors || [];
    const tcpMon = tcpMonitors.find(
      (m: { id: string }) => m.id === String(testTcpMonitorId),
    );

    expect(tcpMon).toBeDefined();
    // Status should be present and be a valid MonitorStatus enum value
    expect(tcpMon.status).toBeDefined();
    expect(["MONITOR_STATUS_ACTIVE", "MONITOR_STATUS_DEGRADED", "MONITOR_STATUS_ERROR", "MONITOR_STATUS_UNSPECIFIED"]).toContain(tcpMon.status);
  });

  test("DNS monitor includes status field in response", async () => {
    const res = await connectRequest(
      "ListMonitors",
      { pageSize: 100 },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    const dnsMonitors = data.dnsMonitors || [];
    const dnsMon = dnsMonitors.find(
      (m: { id: string }) => m.id === String(testDnsMonitorId),
    );

    expect(dnsMon).toBeDefined();
    // Status should be present and be a valid MonitorStatus enum value
    expect(dnsMon.status).toBeDefined();
    expect(["MONITOR_STATUS_ACTIVE", "MONITOR_STATUS_DEGRADED", "MONITOR_STATUS_ERROR", "MONITOR_STATUS_UNSPECIFIED"]).toContain(dnsMon.status);
  });

  test("newly created HTTP monitor has active status by default", async () => {
    const res = await connectRequest(
      "CreateHTTPMonitor",
      {
        monitor: {
          name: "test-status-default",
          url: "https://test-status.example.com",
          periodicity: "PERIODICITY_5M",
          method: "HTTP_METHOD_GET",
        },
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.monitor).toBeDefined();
    // New monitors default to active status
    expect(data.monitor.status).toBe("MONITOR_STATUS_ACTIVE");

    // Clean up
    if (data.monitor.id) {
      await db.delete(monitor).where(eq(monitor.id, Number(data.monitor.id)));
    }
  });

  test("newly created TCP monitor has active status by default", async () => {
    const res = await connectRequest(
      "CreateTCPMonitor",
      {
        monitor: {
          name: "test-tcp-status-default",
          uri: "tcp://test-status.example.com:443",
          periodicity: "PERIODICITY_5M",
        },
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.monitor).toBeDefined();
    // New monitors default to active status
    expect(data.monitor.status).toBe("MONITOR_STATUS_ACTIVE");

    // Clean up
    if (data.monitor.id) {
      await db.delete(monitor).where(eq(monitor.id, Number(data.monitor.id)));
    }
  });

  test("newly created DNS monitor has active status by default", async () => {
    const res = await connectRequest(
      "CreateDNSMonitor",
      {
        monitor: {
          name: "test-dns-status-default",
          uri: "test-status.example.com",
          periodicity: "PERIODICITY_5M",
        },
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.monitor).toBeDefined();
    // New monitors default to active status
    expect(data.monitor.status).toBe("MONITOR_STATUS_ACTIVE");

    // Clean up
    if (data.monitor.id) {
      await db.delete(monitor).where(eq(monitor.id, Number(data.monitor.id)));
    }
  });
});
