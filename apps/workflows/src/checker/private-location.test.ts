import { and, db, eq } from "@openstatus/db";
import {
  monitor,
  notification,
  notificationTrigger,
  notificationsToMonitors,
  privateLocation,
  privateLocationMonitorStatus,
  privateLocationToMonitors,
} from "@openstatus/db/src/schema";
import {
  afterAll,
  afterEach,
  assertSpyCalls,
  beforeAll,
  beforeEach,
  describe,
  expect,
  type Stub,
  stub,
  test,
} from "@openstatus/test-utils";

import { env } from "../env";
import { checkerAudit } from "../utils/audit-log";
import { checkerRoute } from "./index";
import { providerToFunction } from "./utils";

// biome-ignore lint/suspicious/noExplicitAny: heterogeneous provider stubs
type AnyStub = Stub<any>;

// Dedicated fixtures, not seed monitor 1: other suites (api/server maintenance
// tests) put seed monitor 1 under active maintenance on the shared CI database,
// which makes updateStatusPrivate suppress notifications and drop the write.
const TEST_MONITOR_ID = 9101;
const INACTIVE_MONITOR_ID = 9102;
const TEST_NOTIFICATION_ID = 9101;
const TEST_LOCATION_ID = 9001;
const UNATTACHED_LOCATION_ID = 9002;

const cronSecret = env().CRON_SECRET;

type PrivatePayload = {
  monitorId: string;
  privateLocationId: string;
  status: string;
  cronTimestamp: number;
  statusCode?: number;
  latency?: number;
  message?: string;
};

function post(payload: PrivatePayload, authorization = `Basic ${cronSecret}`) {
  return checkerRoute.request("/updateStatusPrivate", {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

function readRow(monitorId: number, privateLocationId: number) {
  return db
    .select()
    .from(privateLocationMonitorStatus)
    .where(
      and(
        eq(privateLocationMonitorStatus.monitorId, monitorId),
        eq(privateLocationMonitorStatus.privateLocationId, privateLocationId),
      ),
    )
    .get();
}

describe("updateStatusPrivate", () => {
  let stubs: AnyStub[] = [];
  let mockEmailSendAlert: AnyStub;
  let mockEmailSendRecovery: AnyStub;
  let mockEmailSendDegraded: AnyStub;

  beforeAll(async () => {
    await db
      .insert(monitor)
      .values([
        {
          id: TEST_MONITOR_ID,
          workspaceId: 1,
          active: true,
          url: "https://private-location.test",
          name: "Private Location Test Monitor",
          periodicity: "1m",
          regions: "ams",
        },
        {
          id: INACTIVE_MONITOR_ID,
          workspaceId: 1,
          active: false,
          url: "https://private-location-inactive.test",
          name: "Private Location Inactive Monitor",
          periodicity: "1m",
          regions: "ams",
        },
      ])
      .onConflictDoNothing()
      .run();
    await db
      .insert(notification)
      .values({
        id: TEST_NOTIFICATION_ID,
        provider: "email",
        name: "private location test notification",
        data: '{"email":"ping@openstatus.dev"}',
        workspaceId: 1,
      })
      .onConflictDoNothing()
      .run();
    await db
      .insert(notificationsToMonitors)
      .values({
        monitorId: TEST_MONITOR_ID,
        notificationId: TEST_NOTIFICATION_ID,
      })
      .onConflictDoNothing()
      .run();
    await db
      .insert(privateLocation)
      .values({
        id: TEST_LOCATION_ID,
        name: "Test Office",
        token: "test-private-location-token",
        workspaceId: 1,
        createdAt: new Date(),
      })
      .onConflictDoNothing()
      .run();
    await db
      .insert(privateLocationToMonitors)
      .values({
        privateLocationId: TEST_LOCATION_ID,
        monitorId: TEST_MONITOR_ID,
        createdAt: new Date(),
      })
      .onConflictDoNothing()
      .run();
  });

  afterAll(async () => {
    await db
      .delete(privateLocationMonitorStatus)
      .where(eq(privateLocationMonitorStatus.monitorId, TEST_MONITOR_ID))
      .run();
    await db
      .delete(notificationTrigger)
      .where(eq(notificationTrigger.monitorId, TEST_MONITOR_ID))
      .run();
    await db
      .delete(privateLocationToMonitors)
      .where(eq(privateLocationToMonitors.privateLocationId, TEST_LOCATION_ID))
      .run();
    await db
      .delete(privateLocation)
      .where(eq(privateLocation.id, TEST_LOCATION_ID))
      .run();
    await db
      .delete(notificationsToMonitors)
      .where(eq(notificationsToMonitors.monitorId, TEST_MONITOR_ID))
      .run();
    await db
      .delete(notification)
      .where(eq(notification.id, TEST_NOTIFICATION_ID))
      .run();
    await db.delete(monitor).where(eq(monitor.id, TEST_MONITOR_ID)).run();
    await db.delete(monitor).where(eq(monitor.id, INACTIVE_MONITOR_ID)).run();
  });

  beforeEach(() => {
    stubs = [];
    stubs.push(
      stub(checkerAudit, "publishAuditLog", () =>
        Promise.resolve({ successful_rows: 1, quarantined_rows: 0 }),
      ) as AnyStub,
    );
    mockEmailSendAlert = stub(providerToFunction.email, "sendAlert", () =>
      Promise.resolve(),
    ) as AnyStub;
    mockEmailSendRecovery = stub(providerToFunction.email, "sendRecovery", () =>
      Promise.resolve(),
    ) as AnyStub;
    mockEmailSendDegraded = stub(providerToFunction.email, "sendDegraded", () =>
      Promise.resolve(),
    ) as AnyStub;
    stubs.push(
      mockEmailSendAlert,
      mockEmailSendRecovery,
      mockEmailSendDegraded,
    );
  });

  afterEach(async () => {
    for (const s of stubs) s.restore();
    stubs = [];
    await db
      .delete(privateLocationMonitorStatus)
      .where(eq(privateLocationMonitorStatus.monitorId, TEST_MONITOR_ID))
      .run();
    await db
      .delete(notificationTrigger)
      .where(eq(notificationTrigger.monitorId, TEST_MONITOR_ID))
      .run();
  });

  test("rejects a wrong CRON_SECRET with 401", async () => {
    const res = await post(
      {
        monitorId: String(TEST_MONITOR_ID),
        privateLocationId: String(TEST_LOCATION_ID),
        status: "error",
        cronTimestamp: 9300001,
      },
      "Basic wrong-secret",
    );
    expect(res.status).toBe(401);
    assertSpyCalls(mockEmailSendAlert, 0);
  });

  test("rejects an invalid payload with 422", async () => {
    const res = await checkerRoute.request("/updateStatusPrivate", {
      method: "POST",
      headers: {
        Authorization: `Basic ${cronSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ monitorId: String(TEST_MONITOR_ID) }),
    });
    expect(res.status).toBe(422);
  });

  test("first error report alerts and writes an error row", async () => {
    const res = await post({
      monitorId: String(TEST_MONITOR_ID),
      privateLocationId: String(TEST_LOCATION_ID),
      status: "error",
      cronTimestamp: 9300010,
      statusCode: 500,
      message: "down",
    });
    expect(res.status).toBe(200);
    assertSpyCalls(mockEmailSendAlert, 1);

    const row = await readRow(TEST_MONITOR_ID, TEST_LOCATION_ID);
    expect(row?.status).toBe("error");
    expect(row?.cronTimestamp).toBe(9300010);
  });

  test("unchanged status does not re-notify but advances the timestamp", async () => {
    await post({
      monitorId: String(TEST_MONITOR_ID),
      privateLocationId: String(TEST_LOCATION_ID),
      status: "error",
      cronTimestamp: 9300020,
    });
    assertSpyCalls(mockEmailSendAlert, 1);

    const res = await post({
      monitorId: String(TEST_MONITOR_ID),
      privateLocationId: String(TEST_LOCATION_ID),
      status: "error",
      cronTimestamp: 9300021,
    });
    expect(res.status).toBe(200);
    assertSpyCalls(mockEmailSendAlert, 1);

    const row = await readRow(TEST_MONITOR_ID, TEST_LOCATION_ID);
    expect(row?.cronTimestamp).toBe(9300021);
  });

  test("recovery after error sends a recovery notification", async () => {
    await post({
      monitorId: String(TEST_MONITOR_ID),
      privateLocationId: String(TEST_LOCATION_ID),
      status: "error",
      cronTimestamp: 9300030,
    });
    assertSpyCalls(mockEmailSendAlert, 1);

    const res = await post({
      monitorId: String(TEST_MONITOR_ID),
      privateLocationId: String(TEST_LOCATION_ID),
      status: "active",
      cronTimestamp: 9300031,
    });
    expect(res.status).toBe(200);
    assertSpyCalls(mockEmailSendRecovery, 1);

    const row = await readRow(TEST_MONITOR_ID, TEST_LOCATION_ID);
    expect(row?.status).toBe("active");
  });

  test("degraded report sends a degraded notification", async () => {
    const res = await post({
      monitorId: String(TEST_MONITOR_ID),
      privateLocationId: String(TEST_LOCATION_ID),
      status: "degraded",
      cronTimestamp: 9300040,
      latency: 5000,
    });
    expect(res.status).toBe(200);
    assertSpyCalls(mockEmailSendDegraded, 1);

    const row = await readRow(TEST_MONITOR_ID, TEST_LOCATION_ID);
    expect(row?.status).toBe("degraded");
  });

  test("a stale (older) report is dropped and does not notify", async () => {
    await post({
      monitorId: String(TEST_MONITOR_ID),
      privateLocationId: String(TEST_LOCATION_ID),
      status: "active",
      cronTimestamp: 9300050,
    });

    const res = await post({
      monitorId: String(TEST_MONITOR_ID),
      privateLocationId: String(TEST_LOCATION_ID),
      status: "error",
      cronTimestamp: 9300049,
    });
    expect(res.status).toBe(200);
    assertSpyCalls(mockEmailSendAlert, 0);

    const row = await readRow(TEST_MONITOR_ID, TEST_LOCATION_ID);
    expect(row?.status).toBe("active");
    expect(row?.cronTimestamp).toBe(9300050);
  });

  test("an unattached location is a no-op", async () => {
    const res = await post({
      monitorId: String(TEST_MONITOR_ID),
      privateLocationId: String(UNATTACHED_LOCATION_ID),
      status: "error",
      cronTimestamp: 9300060,
    });
    expect(res.status).toBe(200);
    assertSpyCalls(mockEmailSendAlert, 0);

    const row = await readRow(TEST_MONITOR_ID, UNATTACHED_LOCATION_ID);
    expect(row).toBeUndefined();
  });

  test("an inactive monitor is a no-op", async () => {
    const res = await post({
      monitorId: String(INACTIVE_MONITOR_ID),
      privateLocationId: String(TEST_LOCATION_ID),
      status: "error",
      cronTimestamp: 9300070,
    });
    expect(res.status).toBe(200);
    assertSpyCalls(mockEmailSendAlert, 0);
  });
});
