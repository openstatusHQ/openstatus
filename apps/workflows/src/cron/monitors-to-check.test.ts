import { db, eq } from "@openstatus/db";
import {
  maintenance,
  maintenancesToPageComponents,
  monitor,
  monitorMaintenanceWindow,
  monitorMaintenanceWindowToMonitor,
  page,
  pageComponent,
} from "@openstatus/db/src/schema";
import {
  createMonitor,
  createPage,
  createPageComponent,
  createTestWorkspace,
} from "@openstatus/db/src/test/factories";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { listMonitorsToCheck } from "./monitors-to-check";

const HOUR_MS = 3_600_000;

let workspaceId: number;
let pageId: number;

beforeAll(async () => {
  const { workspace } = await createTestWorkspace();
  workspaceId = workspace.id;
  pageId = (await createPage(workspaceId)).id;
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

async function putUnderMaintenance(
  monitorId: number,
  from: Date,
  to: Date,
  monitorMaintenanceWindowId?: number,
) {
  const component = await createPageComponent(workspaceId, pageId, {
    type: "monitor",
    monitorId,
  });
  const [window] = await db
    .insert(maintenance)
    .values({
      title: "db upgrade",
      message: "",
      from,
      to,
      monitorMaintenanceWindowId,
      workspaceId,
      pageId,
    })
    .returning();
  if (!window) throw new Error("maintenance insert returned no row");
  await db
    .insert(maintenancesToPageComponents)
    .values({ maintenanceId: window.id, pageComponentId: component.id })
    .run();
}

async function putUnderWindow(
  monitorId: number,
  mode: "pause" | "continue",
  from: Date,
  to: Date,
) {
  const [window] = await db
    .insert(monitorMaintenanceWindow)
    .values({ title: "deploy", mode, from, to, workspaceId })
    .returning();
  if (!window) throw new Error("window insert returned no row");
  await db
    .insert(monitorMaintenanceWindowToMonitor)
    .values({ monitorMaintenanceWindowId: window.id, monitorId })
    .run();
  return window;
}

async function dispatchedIds(now: Date) {
  const rows = await listMonitorsToCheck(db, "1h", now);
  return rows.filter((r) => r.workspaceId === workspaceId).map((r) => r.id);
}

describe("listMonitorsToCheck during maintenance", () => {
  const base = { periodicity: "1h" as const, active: true, regions: "ams" };

  test("a status page maintenance pauses its monitors until it ends", async () => {
    const paused = await createMonitor(workspaceId, base);
    const unaffected = await createMonitor(workspaceId, base);
    const now = Date.now();
    await putUnderMaintenance(
      paused.id,
      new Date(now - HOUR_MS),
      new Date(now + HOUR_MS),
    );

    const during = await dispatchedIds(new Date(now));
    expect(during).toContain(unaffected.id);
    expect(during).not.toContain(paused.id);

    const after = await dispatchedIds(new Date(now + 2 * HOUR_MS));
    expect(after).toContain(paused.id);
  });

  test("a window pauses a monitor on no status page and keeps one set to continue", async () => {
    const paused = await createMonitor(workspaceId, base);
    const continued = await createMonitor(workspaceId, base);
    const now = Date.now();
    const from = new Date(now - HOUR_MS);
    const to = new Date(now + HOUR_MS);
    await putUnderWindow(paused.id, "pause", from, to);
    await putUnderWindow(continued.id, "continue", from, to);

    const during = await dispatchedIds(new Date(now));
    expect(during).not.toContain(paused.id);
    expect(during).toContain(continued.id);
  });

  test("a continue window wins over an overlapping status page maintenance", async () => {
    const m = await createMonitor(workspaceId, base);
    const now = Date.now();
    const from = new Date(now - HOUR_MS);
    const to = new Date(now + HOUR_MS);
    await putUnderMaintenance(m.id, from, to);
    await putUnderWindow(m.id, "continue", from, to);

    expect(await dispatchedIds(new Date(now))).toContain(m.id);
  });

  test("a maintenance announcing a continue window keeps its monitor checked", async () => {
    const m = await createMonitor(workspaceId, base);
    const now = Date.now();
    const from = new Date(now - HOUR_MS);
    const to = new Date(now + HOUR_MS);
    const window = await putUnderWindow(m.id, "continue", from, to);
    await putUnderMaintenance(m.id, from, to, window.id);

    expect(await dispatchedIds(new Date(now))).toContain(m.id);
  });

  test("a linked maintenance pauses nothing outside its window", async () => {
    const inWindow = await createMonitor(workspaceId, base);
    const announcedOnly = await createMonitor(workspaceId, base);
    const now = Date.now();
    const from = new Date(now - HOUR_MS);
    const to = new Date(now + HOUR_MS);
    const window = await putUnderWindow(inWindow.id, "pause", from, to);
    await putUnderMaintenance(announcedOnly.id, from, to, window.id);

    const during = await dispatchedIds(new Date(now));
    expect(during).not.toContain(inWindow.id);
    expect(during).toContain(announcedOnly.id);
  });
});
