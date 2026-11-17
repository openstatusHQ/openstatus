import { and, count, db, eq, isNull } from "@openstatus/db";
import {
  maintenance,
  notificationOutbox,
  monitorIncidentTable,
  monitor,
  monitorMaintenanceWindow,
  monitorMaintenanceWindowToMonitor,
  monitorStatusTable,
  page,
} from "@openstatus/db/src/schema";
import {
  createMonitor,
  createNotification,
  createPage,
  createPageMaintenance,
  createTestWorkspace,
  linkNotificationToMonitor,
} from "@openstatus/db/src/test/factories";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
  type MockInstance,
} from "vitest";

import { applyStatusTransition } from "../checker/transition";
import { providerToFunction } from "../checker/utils";
import { stubPublishAuditLog } from "../test/stub-audit-log";
import { handleStatusDriftCron } from "./status-drift";

// biome-ignore lint/suspicious/noExplicitAny: heterogeneous provider stubs
type AnyStub = MockInstance;
let stubs: AnyStub[] = [];
let workspaceId: number;

beforeAll(async () => {
  const { workspace } = await createTestWorkspace();
  workspaceId = workspace.id;
});

beforeEach(() => {
  stubs = [];
  stubs.push(stubPublishAuditLog());
  stubs.push(
    vi
      .spyOn(providerToFunction.email, "sendAlert")
      .mockImplementation(() => Promise.resolve()),
  );
});

afterEach(() => {
  for (const s of stubs) s.mockRestore();
  stubs = [];
});

afterAll(async () => {
  await db
    .delete(maintenance)
    .where(eq(maintenance.workspaceId, workspaceId))
    .run();
  await db.delete(page).where(eq(page.workspaceId, workspaceId)).run();
  await db
    .delete(monitorMaintenanceWindow)
    .where(eq(monitorMaintenanceWindow.workspaceId, workspaceId))
    .run();
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
      .from(monitorIncidentTable)
      .where(
        and(
          eq(monitorIncidentTable.monitorId, monitorRow.id),
          isNull(monitorIncidentTable.resolvedAt),
        ),
      )
      .all();
    expect(incidents[0]?.total).toBe(1);

    const outbox = await db
      .select({ total: count() })
      .from(notificationOutbox)
      .where(eq(notificationOutbox.monitorId, monitorRow.id))
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

  test("a monitor in maintenance is left alone until the window ends", async () => {
    const monitorRow = await createMonitor(workspaceId, {
      regions: "ams",
      active: true,
    });
    const now = Date.now();
    const window = await db
      .insert(monitorMaintenanceWindow)
      .values({
        workspaceId,
        title: "deploy",
        mode: "pause",
        from: new Date(now - 60 * 60_000),
        to: new Date(now + 60 * 60_000),
      })
      .returning()
      .get();
    await db
      .insert(monitorMaintenanceWindowToMonitor)
      .values({
        monitorMaintenanceWindowId: window.id,
        monitorId: monitorRow.id,
      })
      .run();
    await db
      .insert(monitorStatusTable)
      .values({
        monitorId: monitorRow.id,
        region: "ams",
        status: "error",
        cronTimestamp: now,
      })
      .run();

    const statusOf = async () =>
      (
        await db
          .select({ status: monitor.status })
          .from(monitor)
          .where(eq(monitor.id, monitorRow.id))
          .get()
      )?.status;

    await handleStatusDriftCron();
    expect(await statusOf()).toBe("active");

    await db
      .update(monitorMaintenanceWindow)
      .set({ to: new Date(Date.now() - 1000) })
      .where(eq(monitorMaintenanceWindow.id, window.id))
      .run();
    await handleStatusDriftCron();
    expect(await statusOf()).toBe("error");
  });

  test("a status page maintenance holds the repair back only through its derived window", async () => {
    const now = Date.now();
    const range = {
      from: new Date(now - 60 * 60_000),
      to: new Date(now + 60 * 60_000),
    };
    const statusPage = await createPage(workspaceId);
    const drifted = async (derive: boolean) => {
      const row = await createMonitor(workspaceId, {
        regions: "ams",
        active: true,
      });
      await createPageMaintenance(workspaceId, statusPage.id, {
        monitorId: row.id,
        ...range,
        derive,
      });
      await db
        .insert(monitorStatusTable)
        .values({
          monitorId: row.id,
          region: "ams",
          status: "error",
          cronTimestamp: now,
        })
        .run();
      return row.id;
    };
    const held = await drifted(true);
    const repaired = await drifted(false);

    await handleStatusDriftCron();

    const statusOf = async (id: number) =>
      (
        await db
          .select({ status: monitor.status })
          .from(monitor)
          .where(eq(monitor.id, id))
          .get()
      )?.status;
    expect(await statusOf(held)).toBe("active");
    expect(await statusOf(repaired)).toBe("error");
  });

  test("a duplicated region counts once towards quorum", async () => {
    const monitorRow = await createMonitor(workspaceId, {
      regions: "ams,ams,fra",
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
    expect(after[0]?.status).toBe("error");
  });

  test("a duplicated region with stray whitespace counts once towards quorum", async () => {
    const monitorRow = await createMonitor(workspaceId, {
      regions: "ams, ams, fra",
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
    expect(after[0]?.status).toBe("error");
  });
});

describe("drift repair delivery", () => {
  test("sends the notification the repair is recovering", async () => {
    const sent: string[] = [];
    for (const s of stubs) s.mockRestore();
    stubs = [
      stubPublishAuditLog(),
      vi.spyOn(providerToFunction.email, "sendAlert").mockImplementation(() => {
        sent.push("alert");
        return Promise.resolve();
      }),
    ];

    const monitorRow = await createMonitor(workspaceId, {
      regions: "ams",
      active: true,
    });
    const notif = await createNotification(workspaceId);
    await linkNotificationToMonitor(notif.id, monitorRow.id);

    await db
      .insert(monitorStatusTable)
      .values({
        monitorId: monitorRow.id,
        region: "ams",
        status: "error",
        cronTimestamp: Date.now(),
      })
      .run();

    // OUTBOX_ROLLOUT_PCT defaults to 0, so the repair must fall back to the
    // inline sender rather than writing a row nobody delivers.
    const result = await handleStatusDriftCron();
    expect(result.repaired).toBeGreaterThanOrEqual(1);
    expect(sent.length).toBeGreaterThanOrEqual(1);
  });
});
