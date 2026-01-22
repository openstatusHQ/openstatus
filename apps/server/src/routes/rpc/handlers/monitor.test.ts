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
      {},
      {
        "x-openstatus-key": "1",
      },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    const httpMon = data.httpMonitors.find(
      (m: { id: string }) => m.id === String(testHttpMonitorId),
    );

    expect(httpMon).toBeDefined();
    expect(httpMon.url).toBe("https://example.com");
    expect(httpMon.periodicity).toBe("1m");
    expect(httpMon.method).toBe("GET");
    expect(httpMon.headers).toBeDefined();
    expect(httpMon.statusCodeAssertions).toBeDefined();
    expect(httpMon.bodyAssertions).toBeDefined();
    expect(httpMon.headerAssertions).toBeDefined();
  });

  test("returns TCP monitors with correct structure", async () => {
    const res = await connectRequest(
      "ListMonitors",
      {},
      {
        "x-openstatus-key": "1",
      },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    const tcpMon = data.tcpMonitors.find(
      (m: { id: string }) => m.id === String(testTcpMonitorId),
    );

    expect(tcpMon).toBeDefined();
    expect(tcpMon.uri).toBe("tcp://example.com:443");
    expect(tcpMon.periodicity).toBe("5m");
  });

  test("returns DNS monitors with correct structure", async () => {
    const res = await connectRequest(
      "ListMonitors",
      {},
      {
        "x-openstatus-key": "1",
      },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    const dnsMon = data.dnsMonitors.find(
      (m: { id: string }) => m.id === String(testDnsMonitorId),
    );

    expect(dnsMon).toBeDefined();
    expect(dnsMon.uri).toBe("example.com");
    expect(dnsMon.periodicity).toBe("10m");
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
    const totalMonitors =
      data.httpMonitors.length +
      data.tcpMonitors.length +
      data.dnsMonitors.length;

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

      // The monitors from second page should be different from first page
      const firstPageIds = [
        ...data1.httpMonitors.map((m: { id: string }) => m.id),
        ...data1.tcpMonitors.map((m: { id: string }) => m.id),
        ...data1.dnsMonitors.map((m: { id: string }) => m.id),
      ];
      const secondPageIds = [
        ...data2.httpMonitors.map((m: { id: string }) => m.id),
        ...data2.tcpMonitors.map((m: { id: string }) => m.id),
        ...data2.dnsMonitors.map((m: { id: string }) => m.id),
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
        {},
        {
          "x-openstatus-key": "1",
        },
      );

      expect(res.status).toBe(200);

      const data = await res.json();
      const allMonitorIds = [
        ...data.httpMonitors.map((m: { id: string }) => m.id),
        ...data.tcpMonitors.map((m: { id: string }) => m.id),
        ...data.dnsMonitors.map((m: { id: string }) => m.id),
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
          url: "https://create-test.example.com",
          periodicity: "5m",
          method: "POST",
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
    expect(data.monitor.periodicity).toBe("5m");
    expect(data.monitor.method).toBe("POST");

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
          uri: "tcp://create-tcp-test.example.com:8080",
          periodicity: "10m",
          timeout: "15000",
        },
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.monitor).toBeDefined();
    expect(data.monitor.uri).toBe("tcp://create-tcp-test.example.com:8080");
    expect(data.monitor.periodicity).toBe("10m");

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
          uri: "create-dns-test.example.com",
          periodicity: "30m",
          timeout: "5000",
          recordAssertions: [
            { record: "A", target: "1.2.3.4", comparator: 1 },
          ],
        },
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.monitor).toBeDefined();
    expect(data.monitor.uri).toBe("create-dns-test.example.com");
    expect(data.monitor.periodicity).toBe("30m");

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
