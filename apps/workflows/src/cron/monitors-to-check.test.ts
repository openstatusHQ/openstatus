import { db, eq } from "@openstatus/db";
import {
  maintenance,
  monitor,
  monitorMaintenanceWindow,
  monitorMaintenanceWindowToMonitor,
  page,
  pageComponent,
} from "@openstatus/db/src/schema";
import {
  createMonitor,
  createPage,
  createPageMaintenance,
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

function putUnderMaintenance(
  monitorId: number,
  from: Date,
  to: Date,
  options: { announcesWindowId?: number; derive?: boolean } = {},
) {
  return createPageMaintenance(workspaceId, pageId, {
    monitorId,
    from,
    to,
    ...options,
  });
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

  test("a status page maintenance pauses its monitors through its derived window, until it ends", async () => {
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

  test("a status page maintenance without a window pauses nothing", async () => {
    const m = await createMonitor(workspaceId, base);
    const now = Date.now();
    await putUnderMaintenance(
      m.id,
      new Date(now - HOUR_MS),
      new Date(now + HOUR_MS),
      { derive: false },
    );

    expect(await dispatchedIds(new Date(now))).toContain(m.id);
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
    await putUnderMaintenance(m.id, from, to, {
      announcesWindowId: window.id,
    });

    expect(await dispatchedIds(new Date(now))).toContain(m.id);
  });

  test("an announcement pauses nothing outside its window, whatever its components and times", async () => {
    const inWindow = await createMonitor(workspaceId, base);
    const announcedOnly = await createMonitor(workspaceId, base);
    const now = Date.now();
    const from = new Date(now - HOUR_MS);
    const to = new Date(now + HOUR_MS);
    const window = await putUnderWindow(inWindow.id, "pause", from, to);
    await putUnderMaintenance(
      announcedOnly.id,
      new Date(now - 2 * HOUR_MS),
      new Date(now + 2 * HOUR_MS),
      { announcesWindowId: window.id },
    );

    const during = await dispatchedIds(new Date(now));
    expect(during).not.toContain(inWindow.id);
    expect(during).toContain(announcedOnly.id);
  });
});
