import { db, eq } from "@openstatus/db";
import {
  incidentTable,
  monitor,
  notificationOutbox,
  notificationTrigger,
} from "@openstatus/db/src/schema";
import {
  createMonitor,
  createNotification,
  createTestWorkspace,
  linkNotificationToMonitor,
} from "@openstatus/db/src/test/factories";
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
let stubs: AnyStub[] = [];

let workspaceId: number;
let monitorId: number;
let notificationId: number;

const cronSecret = env().CRON_SECRET;

beforeAll(async () => {
  const { workspace } = await createTestWorkspace();
  workspaceId = workspace.id;
  const monitorRow = await createMonitor(workspaceId, {
    regions: "ams",
    status: "active",
  });
  monitorId = monitorRow.id;
  const notif = await createNotification(workspaceId, { provider: "email" });
  notificationId = notif.id;
  await linkNotificationToMonitor(notificationId, monitorId);
});

afterAll(async () => {
  await db.delete(monitor).where(eq(monitor.workspaceId, workspaceId)).run();
});

beforeEach(() => {
  stubs = [];
});

afterEach(async () => {
  for (const s of stubs) s.restore();
  stubs = [];
  await db
    .delete(notificationTrigger)
    .where(eq(notificationTrigger.monitorId, monitorId))
    .run();
  await db
    .delete(notificationOutbox)
    .where(eq(notificationOutbox.monitorId, monitorId))
    .run();
  await db
    .delete(incidentTable)
    .where(eq(incidentTable.monitorId, monitorId))
    .run();
  await db
    .update(monitor)
    .set({ status: "active" })
    .where(eq(monitor.id, monitorId))
    .run();
});

function post(payload: Record<string, unknown>) {
  return checkerRoute.request("/updateStatus", {
    method: "POST",
    headers: {
      Authorization: `Basic ${cronSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

describe("updateStatus audit failures", () => {
  test("a failing audit log does not cost the notification", async () => {
    // Tinybird is down: every audit publish rejects, including the status one
    // that runs after the transition batch has committed.
    stubs.push(
      stub(checkerAudit, "publishAuditLog", () =>
        Promise.reject(new Error("tinybird unavailable")),
      ) as AnyStub,
    );
    const sendAlert = stub(providerToFunction.email, "sendAlert", () =>
      Promise.resolve(),
    );
    stubs.push(sendAlert as AnyStub);

    const res = await post({
      monitorId: String(monitorId),
      region: "ams",
      status: "error",
      cronTimestamp: Date.now(),
      statusCode: 500,
    });

    // Retrying this transition is useless — the region status is already
    // written, so the retry takes the fast path and sends nothing.
    expect(res.status).toBe(200);
    assertSpyCalls(sendAlert, 1);

    const rows = await db
      .select()
      .from(monitor)
      .where(eq(monitor.id, monitorId))
      .all();
    expect(rows[0]?.status).toBe("error");
  });
});
