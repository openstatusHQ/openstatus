import { and, db, eq, or } from "@openstatus/db";
import {
  monitor,
  notification,
  notificationTrigger,
  notificationsToMonitors,
  privateLocation,
  privateLocationMonitorStatus,
  privateLocationToMonitors,
} from "@openstatus/db/src/schema";
import { createTestWorkspace } from "@openstatus/db/src/test/factories";
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
let workspaceId: number;
const TEST_MONITOR_ID = 9101;
const INACTIVE_MONITOR_ID = 9102;
const TEST_NOTIFICATION_ID = 9101;
const TEST_LOCATION_ID = 9001;
const UNATTACHED_LOCATION_ID = 9002;
const PRIVATE_ONLY_MONITOR_ID = 9103;
const PRIVATE_LOCATION_2_ID = 9003;
const PRIVATE_LOCATION_3_ID = 9004;

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
    workspaceId = (await createTestWorkspace()).workspace.id;
    await db
      .insert(monitor)
      .values([
        {
          id: TEST_MONITOR_ID,
          workspaceId,
          active: true,
          url: "https://private-location.test",
          name: "Private Location Test Monitor",
          periodicity: "1m",
          regions: "ams",
        },
        {
          id: INACTIVE_MONITOR_ID,
          workspaceId,
          active: false,
          url: "https://private-location-inactive.test",
          name: "Private Location Inactive Monitor",
          periodicity: "1m",
          regions: "ams",
        },
        {
          id: PRIVATE_ONLY_MONITOR_ID,
          workspaceId,
          active: true,
          url: "https://private-only.test",
          name: "Private-Only Monitor (No Cloud Regions)",
          periodicity: "1m",
          regions: "",
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
        workspaceId,
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
        workspaceId,
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

    // Additional private locations for multi-location tests
    await db
      .insert(privateLocation)
      .values([
        {
          id: PRIVATE_LOCATION_2_ID,
          name: "Test Office 2",
          token: "test-private-location-token-2",
          workspaceId,
          createdAt: new Date(),
        },
        {
          id: PRIVATE_LOCATION_3_ID,
          name: "Test Office 3",
          token: "test-private-location-token-3",
          workspaceId,
          createdAt: new Date(),
        },
      ])
      .onConflictDoNothing()
      .run();

    // Link all three locations to private-only monitor
    await db
      .insert(privateLocationToMonitors)
      .values([
        {
          privateLocationId: TEST_LOCATION_ID,
          monitorId: PRIVATE_ONLY_MONITOR_ID,
          createdAt: new Date(),
        },
        {
          privateLocationId: PRIVATE_LOCATION_2_ID,
          monitorId: PRIVATE_ONLY_MONITOR_ID,
          createdAt: new Date(),
        },
        {
          privateLocationId: PRIVATE_LOCATION_3_ID,
          monitorId: PRIVATE_ONLY_MONITOR_ID,
          createdAt: new Date(),
        },
      ])
      .onConflictDoNothing()
      .run();

    // Link first location to private-only monitor for notifications
    await db
      .insert(notificationsToMonitors)
      .values({
        monitorId: PRIVATE_ONLY_MONITOR_ID,
        notificationId: TEST_NOTIFICATION_ID,
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
    // Cleanup private-only monitor fixtures
    await db
      .delete(privateLocationMonitorStatus)
      .where(
        eq(privateLocationMonitorStatus.monitorId, PRIVATE_ONLY_MONITOR_ID),
      )
      .run();
    await db
      .delete(notificationTrigger)
      .where(eq(notificationTrigger.monitorId, PRIVATE_ONLY_MONITOR_ID))
      .run();
    await db
      .delete(notificationsToMonitors)
      .where(eq(notificationsToMonitors.monitorId, PRIVATE_ONLY_MONITOR_ID))
      .run();
    await db
      .delete(privateLocationToMonitors)
      .where(
        or(
          eq(privateLocationToMonitors.privateLocationId, TEST_LOCATION_ID),
          eq(
            privateLocationToMonitors.privateLocationId,
            PRIVATE_LOCATION_2_ID,
          ),
          eq(
            privateLocationToMonitors.privateLocationId,
            PRIVATE_LOCATION_3_ID,
          ),
        ),
      )
      .run();
    await db
      .delete(privateLocation)
      .where(
        or(
          eq(privateLocation.id, PRIVATE_LOCATION_2_ID),
          eq(privateLocation.id, PRIVATE_LOCATION_3_ID),
        ),
      )
      .run();
    await db.delete(monitor).where(eq(monitor.id, TEST_MONITOR_ID)).run();
    await db.delete(monitor).where(eq(monitor.id, INACTIVE_MONITOR_ID)).run();
    await db
      .delete(monitor)
      .where(eq(monitor.id, PRIVATE_ONLY_MONITOR_ID))
      .run();
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
      .delete(privateLocationMonitorStatus)
      .where(eq(privateLocationMonitorStatus.monitorId, PRIVATE_ONLY_MONITOR_ID))
      .run();
    await db
      .delete(notificationTrigger)
      .where(eq(notificationTrigger.monitorId, TEST_MONITOR_ID))
      .run();
    await db
      .delete(notificationTrigger)
      .where(eq(notificationTrigger.monitorId, PRIVATE_ONLY_MONITOR_ID))
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

  test("private-only monitor: updates status when threshold met (2/3 locations agree)", async () => {
    // First location reports error → 1/3 < 50% → should NOT update monitor status
    const res1 = await post({
      monitorId: String(PRIVATE_ONLY_MONITOR_ID),
      privateLocationId: String(TEST_LOCATION_ID),
      status: "error",
      cronTimestamp: 9310010,
      statusCode: 500,
      message: "down",
    });
    expect(res1.status).toBe(200);

    const monitorAfter1 = await db
      .select()
      .from(monitor)
      .where(eq(monitor.id, PRIVATE_ONLY_MONITOR_ID))
      .get();
    expect(monitorAfter1?.status).toBe("active"); // Threshold not met

    // Second location reports error → 2/3 >= 50% → SHOULD update monitor status
    const res2 = await post({
      monitorId: String(PRIVATE_ONLY_MONITOR_ID),
      privateLocationId: String(PRIVATE_LOCATION_2_ID),
      status: "error",
      cronTimestamp: 9310020,
      statusCode: 500,
      message: "down",
    });
    expect(res2.status).toBe(200);

    const monitorAfter2 = await db
      .select()
      .from(monitor)
      .where(eq(monitor.id, PRIVATE_ONLY_MONITOR_ID))
      .get();
    expect(monitorAfter2?.status).toBe("error");
    assertSpyCalls(mockEmailSendAlert, 1);
  });

  test("does not change monitor.status from error when 1/3 locations report degraded (threshold not met)", async () => {
    // First seed the monitor to "error" state via 2/3 locations agreeing
    await post({
      monitorId: String(PRIVATE_ONLY_MONITOR_ID),
      privateLocationId: String(TEST_LOCATION_ID),
      status: "error",
      cronTimestamp: 9320000,
      statusCode: 500,
      message: "down",
    });
    await post({
      monitorId: String(PRIVATE_ONLY_MONITOR_ID),
      privateLocationId: String(PRIVATE_LOCATION_2_ID),
      status: "error",
      cronTimestamp: 9320005,
      statusCode: 500,
      message: "down",
    });

    // Now try degraded with only 1/3 → should NOT change
    const res = await post({
      monitorId: String(PRIVATE_ONLY_MONITOR_ID),
      privateLocationId: String(PRIVATE_LOCATION_3_ID),
      status: "degraded",
      cronTimestamp: 9320010,
      statusCode: 200,
    });
    expect(res.status).toBe(200);

    const monitorAfter = await db
      .select()
      .from(monitor)
      .where(eq(monitor.id, PRIVATE_ONLY_MONITOR_ID))
      .get();
    // Monitor should remain "error" because 1/3 < 50% threshold
    expect(monitorAfter?.status).toBe("error");
  });

  test("does not update monitor.status for monitors with cloud regions", async () => {
    // TEST_MONITOR_ID has regions: "ams" (cloud region)
    const res = await post({
      monitorId: String(TEST_MONITOR_ID),
      privateLocationId: String(TEST_LOCATION_ID),
      status: "error",
      cronTimestamp: 9330010,
      statusCode: 500,
      message: "down",
    });
    expect(res.status).toBe(200);

    const monitorAfter = await db
      .select()
      .from(monitor)
      .where(eq(monitor.id, TEST_MONITOR_ID))
      .get();
    // Monitor has cloud regions, so private status updates should not affect it
    expect(monitorAfter?.status).toBe("active");
  });
});
