import { and, count, db, eq, isNull } from "@openstatus/db";
import {
  maintenance,
  notificationOutbox,
  monitorIncidentTable,
  monitor,
  monitorMaintenanceWindow,
  monitorStatusTable,
  page,
  pageComponent,
  selectWorkspaceSchema,
} from "@openstatus/db/src/schema";
import {
  createMaintenanceWindow,
  createMonitor,
  createNotification,
  createPage,
  createPageMaintenance,
  createTestWorkspace,
  linkNotificationToMonitor,
} from "@openstatus/db/src/test/factories";
import type { ServiceContext } from "@openstatus/services";
import { updateMonitorConfig } from "@openstatus/services/monitor";
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
import { repairStatusDrift } from "./status-drift";

// biome-ignore lint/suspicious/noExplicitAny: heterogeneous provider stubs
type AnyStub = MockInstance;
let stubs: AnyStub[] = [];
let workspaceId: number;
let ctx: ServiceContext;

beforeAll(async () => {
  const { workspace, user } = await createTestWorkspace();
  workspaceId = workspace.id;
  ctx = {
    workspace: selectWorkspaceSchema.parse(workspace),
    actor: { type: "user", userId: user.id },
  };
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
    .delete(monitorMaintenanceWindow)
    .where(eq(monitorMaintenanceWindow.workspaceId, workspaceId))
    .run();
  await db
    .delete(maintenance)
    .where(eq(maintenance.workspaceId, workspaceId))
    .run();
  await db
    .delete(pageComponent)
    .where(eq(pageComponent.workspaceId, workspaceId))
    .run();
  await db.delete(page).where(eq(page.workspaceId, workspaceId)).run();
  await db.delete(monitor).where(eq(monitor.workspaceId, workspaceId)).run();
});

describe("repairStatusDrift", () => {
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

    const result = await repairStatusDrift(workspaceId);
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

    await repairStatusDrift(workspaceId);

    const after = await db
      .select({ status: monitor.status })
      .from(monitor)
      .where(eq(monitor.id, monitorRow.id))
      .all();
    expect(after[0]?.status).toBe("active");
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

    await repairStatusDrift(workspaceId);

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

    await repairStatusDrift(workspaceId);

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
    const result = await repairStatusDrift(workspaceId);
    expect(result.repaired).toBeGreaterThanOrEqual(1);
    expect(sent.length).toBeGreaterThanOrEqual(1);
  });
});

describe("drift repair during maintenance", () => {
  async function driftedMonitor() {
    const row = await createMonitor(workspaceId, {
      regions: "ams",
      active: true,
    });
    await db
      .insert(monitorStatusTable)
      .values({
        monitorId: row.id,
        region: "ams",
        status: "error",
        cronTimestamp: Date.now(),
      })
      .run();
    return row;
  }

  async function statusOf(monitorId: number) {
    const row = await db
      .select({ status: monitor.status })
      .from(monitor)
      .where(eq(monitor.id, monitorId))
      .get();
    return row?.status;
  }

  const range = () => ({
    from: new Date(Date.now() - 3_600_000),
    to: new Date(Date.now() + 3_600_000),
  });

  test.each(["pause", "continue"] as const)(
    "a %s window holds the repair back",
    async (mode) => {
      const row = await driftedMonitor();
      await createMaintenanceWindow(workspaceId, {
        monitorIds: [row.id],
        mode,
        ...range(),
      });

      await repairStatusDrift(workspaceId);

      expect(await statusOf(row.id)).toBe("active");
    },
  );

  test("a window does not hold a recovery repair back", async () => {
    const row = await createMonitor(workspaceId, {
      regions: "ams",
      active: true,
      status: "error",
    });
    await db
      .insert(monitorStatusTable)
      .values({
        monitorId: row.id,
        region: "ams",
        status: "active",
        cronTimestamp: Date.now(),
      })
      .run();
    await createMaintenanceWindow(workspaceId, {
      monitorIds: [row.id],
      mode: "continue",
      ...range(),
    });

    await repairStatusDrift(workspaceId);

    expect(await statusOf(row.id)).toBe("active");
  });

  test("a status-page maintenance does not hold the repair back, as before", async () => {
    const row = await driftedMonitor();
    const pageId = (await createPage(workspaceId)).id;
    await createPageMaintenance(workspaceId, pageId, {
      monitorId: row.id,
      ...range(),
    });

    await repairStatusDrift(workspaceId);

    expect(await statusOf(row.id)).toBe("error");
  });
});

describe("pausing a failing monitor", () => {
  test("closes its outage; after a resume only a failing check reopens one", async () => {
    const monitorRow = await createMonitor(workspaceId, {
      regions: "ams",
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
    await repairStatusDrift(workspaceId);

    const openIncidents = () =>
      db
        .select()
        .from(monitorIncidentTable)
        .where(
          and(
            eq(monitorIncidentTable.monitorId, monitorRow.id),
            isNull(monitorIncidentTable.resolvedAt),
          ),
        )
        .all();
    const [firstOutage] = await openIncidents();
    expect(firstOutage).toBeDefined();

    await updateMonitorConfig({
      ctx,
      input: { id: monitorRow.id, active: false },
    });
    expect(await openIncidents()).toHaveLength(0);

    await updateMonitorConfig({
      ctx,
      input: { id: monitorRow.id, active: true },
    });
    // the pause cleared the stale region failure: no outage without a check
    await repairStatusDrift(workspaceId);
    expect(await openIncidents()).toHaveLength(0);

    // A new outage cannot share the first one's (monitor_id, started_at) second.
    await applyStatusTransition({
      monitorId: monitorRow.id,
      region: "ams",
      status: "error",
      cronTimestamp: Date.now() + 60_000,
      deadlineSeconds: 60,
      rolloutPct: 0,
    });

    const reopened = await openIncidents();
    expect(reopened).toHaveLength(1);
    expect(reopened[0]?.id).not.toBe(firstOutage?.id);
  });
});
