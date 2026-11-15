import { db, eq } from "@openstatus/db";
import {
  maintenance,
  maintenancesToPageComponents,
  monitor,
  monitorIncidentTable,
  monitorMaintenanceWindow,
  monitorMaintenanceWindowToMonitor,
  monitorStatusTable,
  notificationOutbox,
  notificationTrigger,
  page,
  pageComponent,
} from "@openstatus/db/src/schema";
import {
  createMonitor,
  createNotification,
  createPage,
  createPageComponent,
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

import { env } from "../env";
import { stubPublishAuditLog } from "../test/stub-audit-log";
import { checkerRoute } from "./index";
import { isInMaintenance } from "./maintenance";
import { providerToFunction } from "./utils";

const HOUR_MS = 3_600_000;
const cronSecret = env().CRON_SECRET;

let workspaceId: number;
let pageId: number;
let notificationId: number;
let stubs: MockInstance[] = [];
let sendAlert: MockInstance;

beforeAll(async () => {
  const { workspace } = await createTestWorkspace();
  workspaceId = workspace.id;
  pageId = (await createPage(workspaceId)).id;
  notificationId = (
    await createNotification(workspaceId, { provider: "email" })
  ).id;
});

beforeEach(() => {
  sendAlert = vi
    .spyOn(providerToFunction.email, "sendAlert")
    .mockImplementation(() => Promise.resolve());
  stubs = [stubPublishAuditLog(), sendAlert];
});

afterEach(() => {
  for (const s of stubs) s.mockRestore();
  stubs = [];
});

afterAll(async () => {
  const monitors = await db
    .select({ id: monitor.id })
    .from(monitor)
    .where(eq(monitor.workspaceId, workspaceId))
    .all();
  for (const { id } of monitors) {
    await db
      .delete(notificationTrigger)
      .where(eq(notificationTrigger.monitorId, id))
      .run();
    await db
      .delete(notificationOutbox)
      .where(eq(notificationOutbox.monitorId, id))
      .run();
    await db
      .delete(monitorIncidentTable)
      .where(eq(monitorIncidentTable.monitorId, id))
      .run();
    await db
      .delete(monitorStatusTable)
      .where(eq(monitorStatusTable.monitorId, id))
      .run();
  }
  await db
    .delete(maintenance)
    .where(eq(maintenance.workspaceId, workspaceId))
    .run();
  await db
    .delete(monitorMaintenanceWindow)
    .where(eq(monitorMaintenanceWindow.workspaceId, workspaceId))
    .run();
  await db
    .delete(pageComponent)
    .where(eq(pageComponent.workspaceId, workspaceId))
    .run();
  await db.delete(page).where(eq(page.workspaceId, workspaceId)).run();
  await db.delete(monitor).where(eq(monitor.workspaceId, workspaceId)).run();
});

/** continue: a maintenance window. pause: a status page maintenance. linked: a continue window and its announcement. */
async function monitorUnderMaintenance(mode: "pause" | "continue" | "linked") {
  const row = await createMonitor(workspaceId, {
    regions: "ams",
    status: "active",
    active: true,
  });
  await linkNotificationToMonitor(notificationId, row.id);
  const now = Date.now();
  const from = new Date(now - HOUR_MS);
  const to = new Date(now + HOUR_MS);

  let windowId: number | undefined;
  if (mode === "continue" || mode === "linked") {
    const [window] = await db
      .insert(monitorMaintenanceWindow)
      .values({ title: "db upgrade", mode: "continue", from, to, workspaceId })
      .returning();
    if (!window) throw new Error("window insert returned no row");
    await db
      .insert(monitorMaintenanceWindowToMonitor)
      .values({ monitorMaintenanceWindowId: window.id, monitorId: row.id })
      .run();
    windowId = window.id;
  }
  if (mode === "continue" && windowId !== undefined) {
    const id = windowId;
    return {
      monitorId: row.id,
      startAt: (start: Date) =>
        db
          .update(monitorMaintenanceWindow)
          .set({ from: start })
          .where(eq(monitorMaintenanceWindow.id, id))
          .run(),
      endAt: (end: Date) =>
        db
          .update(monitorMaintenanceWindow)
          .set({ to: end })
          .where(eq(monitorMaintenanceWindow.id, id))
          .run(),
    };
  }

  const component = await createPageComponent(workspaceId, pageId, {
    type: "monitor",
    monitorId: row.id,
  });
  const [m] = await db
    .insert(maintenance)
    .values({
      title: "db upgrade",
      message: "",
      from,
      to,
      monitorMaintenanceWindowId: windowId,
      workspaceId,
      pageId,
    })
    .returning();
  if (!m) throw new Error("maintenance insert returned no row");
  await db
    .insert(maintenancesToPageComponents)
    .values({ maintenanceId: m.id, pageComponentId: component.id })
    .run();
  return {
    monitorId: row.id,
    startAt: (start: Date) =>
      db
        .update(maintenance)
        .set({ from: start })
        .where(eq(maintenance.id, m.id))
        .run(),
    endAt: (end: Date) =>
      db
        .update(maintenance)
        .set({ to: end })
        .where(eq(maintenance.id, m.id))
        .run(),
  };
}

function postError(monitorId: number, cronTimestamp = Date.now()) {
  return checkerRoute.request("/updateStatus", {
    method: "POST",
    headers: {
      Authorization: `Basic ${cronSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      monitorId: String(monitorId),
      region: "ams",
      status: "error",
      cronTimestamp,
      statusCode: 500,
    }),
  });
}

async function stateOf(monitorId: number) {
  const row = await db
    .select({ status: monitor.status })
    .from(monitor)
    .where(eq(monitor.id, monitorId))
    .get();
  const regions = await db
    .select()
    .from(monitorStatusTable)
    .where(eq(monitorStatusTable.monitorId, monitorId))
    .all();
  const incidents = await db
    .select()
    .from(monitorIncidentTable)
    .where(eq(monitorIncidentTable.monitorId, monitorId))
    .all();
  return { status: row?.status, regions, incidents };
}

describe("updateStatus for a monitor that keeps checking during maintenance", () => {
  test("a failure inside the window changes nothing and notifies nobody", async () => {
    const { monitorId } = await monitorUnderMaintenance("continue");

    const res = await postError(monitorId);

    expect(res.status).toBe(200);
    const state = await stateOf(monitorId);
    expect(state.status).toBe("active");
    expect(state.regions).toHaveLength(0);
    expect(state.incidents).toHaveLength(0);
    expect(sendAlert).not.toHaveBeenCalled();
  });

  test("a failure under an announced continue window changes nothing", async () => {
    const { monitorId } = await monitorUnderMaintenance("linked");

    const res = await postError(monitorId);

    expect(res.status).toBe(200);
    const state = await stateOf(monitorId);
    expect(state.status).toBe("active");
    expect(state.incidents).toHaveLength(0);
    expect(sendAlert).not.toHaveBeenCalled();
  });

  test("a failure that persists after the window opens the incident then", async () => {
    const { monitorId, endAt } = await monitorUnderMaintenance("continue");
    await postError(monitorId);

    await endAt(new Date(Date.now() - 1000));
    const res = await postError(monitorId);

    expect(res.status).toBe(200);
    const state = await stateOf(monitorId);
    expect(state.status).toBe("error");
    expect(state.incidents).toHaveLength(1);
    expect(sendAlert).toHaveBeenCalledTimes(1);
  });

  test("a check that ran inside the window but arrives after it changes nothing", async () => {
    const { monitorId, endAt } = await monitorUnderMaintenance("continue");
    const ranAt = Date.now() - 2000;
    await endAt(new Date(Date.now() - 1000));

    const res = await postError(monitorId, ranAt);

    expect(res.status).toBe(200);
    const state = await stateOf(monitorId);
    expect(state.status).toBe("active");
    expect(state.incidents).toHaveLength(0);
    expect(sendAlert).not.toHaveBeenCalled();
  });
});

describe("updateStatus for a monitor that pauses during maintenance", () => {
  test("a result from a check that ran inside the window alerts nobody", async () => {
    const { monitorId } = await monitorUnderMaintenance("pause");

    await postError(monitorId);

    const state = await stateOf(monitorId);
    expect(state.status).toBe("active");
    expect(state.incidents).toHaveLength(0);
    expect(sendAlert).not.toHaveBeenCalled();
  });

  test("a result from a check that ran before the window is processed as usual", async () => {
    const { monitorId, startAt } = await monitorUnderMaintenance("pause");
    const now = Date.now();
    await startAt(new Date(now - 60_000));

    // still fresh (under the stale cutoff), but stamped before the window
    await postError(monitorId, now - 5 * 60_000);

    const state = await stateOf(monitorId);
    expect(state.status).toBe("error");
    expect(state.incidents).toHaveLength(1);
    expect(sendAlert).toHaveBeenCalledTimes(1);
  });
});

describe("isInMaintenance", () => {
  test("the end instant is outside the window, the instant before is inside", async () => {
    const { monitorId, endAt } = await monitorUnderMaintenance("continue");
    const to = new Date(Math.floor(Date.now() / 1000) * 1000 + HOUR_MS);
    await endAt(to);

    expect(await isInMaintenance(monitorId, to)).toBe(false);
    expect(await isInMaintenance(monitorId, new Date(to.getTime() - 1))).toBe(
      true,
    );
  });

  test("a pausing status page maintenance counts", async () => {
    const { monitorId } = await monitorUnderMaintenance("pause");
    expect(await isInMaintenance(monitorId, new Date())).toBe(true);
  });

  test("an announced continue window counts", async () => {
    const { monitorId } = await monitorUnderMaintenance("linked");
    expect(await isInMaintenance(monitorId, new Date())).toBe(true);
  });
});
