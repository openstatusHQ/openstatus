import { and, count, db, eq, isNull } from "@openstatus/db";
import {
  checkerOutbox,
  incidentTable,
  monitor,
  monitorStatusTable,
} from "@openstatus/db/src/schema";
import {
  createMonitor,
  createNotification,
  createTestWorkspace,
  linkNotificationToMonitor,
} from "@openstatus/db/src/test/factories";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  test,
} from "@openstatus/test-utils";

import { applyStatusTransition } from "../checker/transition";
import { handleStatusDriftCron } from "./status-drift";

let workspaceId: number;

beforeAll(async () => {
  const { workspace } = await createTestWorkspace();
  workspaceId = workspace.id;
});

afterAll(async () => {
  await db.delete(monitor).where(eq(monitor.workspaceId, workspaceId)).run();
});

describe("handleStatusDriftCron", () => {
  test("re-evaluates a monitor whose region write landed without its transition", async () => {
    const monitorRow = await createMonitor(workspaceId, {
      regions: "ams",
      active: true,
    });
    const notif = await createNotification(workspaceId);
    await linkNotificationToMonitor(notif.id, monitorRow.id);

    // Exactly the state a crash between the region write and the batch leaves:
    // the region says error, the monitor still says active.
    await db
      .insert(monitorStatusTable)
      .values({
        monitorId: monitorRow.id,
        region: "ams",
        status: "error",
        cronTimestamp: Date.now(),
      })
      .run();

    // A replay of the same check cannot recover it: the region status is
    // unchanged, so the fast path short-circuits.
    const replay = await applyStatusTransition({
      monitorId: monitorRow.id,
      region: "ams",
      status: "error",
      cronTimestamp: Date.now() + 1000,
      deadlineSeconds: 300,
      rolloutPct: 100,
    });
    expect(replay.kind).toBe("unchanged");

    const beforeRepair = await db
      .select({ status: monitor.status })
      .from(monitor)
      .where(eq(monitor.id, monitorRow.id))
      .all();
    expect(beforeRepair[0]?.status).toBe("active");

    const result = await handleStatusDriftCron();
    expect(result.repaired).toBeGreaterThanOrEqual(1);

    const afterRepair = await db
      .select({ status: monitor.status })
      .from(monitor)
      .where(eq(monitor.id, monitorRow.id))
      .all();
    expect(afterRepair[0]?.status).toBe("error");

    const incidents = await db
      .select({ total: count() })
      .from(incidentTable)
      .where(
        and(
          eq(incidentTable.monitorId, monitorRow.id),
          isNull(incidentTable.resolvedAt),
        ),
      )
      .all();
    expect(incidents[0]?.total).toBe(1);

    const outbox = await db
      .select({ total: count() })
      .from(checkerOutbox)
      .where(eq(checkerOutbox.monitorId, monitorRow.id))
      .all();
    expect(outbox[0]?.total).toBe(1);
  });

  test("a monitor below quorum is not a drift candidate", async () => {
    const monitorRow = await createMonitor(workspaceId, {
      regions: "ams,arn,atl,bog",
      active: true,
    });

    await db
      .insert(monitorStatusTable)
      .values({
        monitorId: monitorRow.id,
        region: "ams",
        status: "error",
        cronTimestamp: Date.now(),
      })
      .run();

    await handleStatusDriftCron();

    const after = await db
      .select({ status: monitor.status })
      .from(monitor)
      .where(eq(monitor.id, monitorRow.id))
      .all();
    expect(after[0]?.status).toBe("active");
  });
});
