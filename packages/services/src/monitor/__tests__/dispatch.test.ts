import { db, eq } from "@openstatus/db";
import { PAGE_MAINTENANCE_PAUSE_ENDS } from "@openstatus/db/src/maintenance";
import {
  maintenance,
  monitor,
  monitorMaintenanceWindow,
  page,
  pageComponent,
} from "@openstatus/db/src/schema";
import {
  createMaintenanceWindow,
  createMonitor,
  createPage,
  createPageMaintenance,
  createTestWorkspace,
} from "@openstatus/db/src/test/factories";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { countPausedMonitors, listMonitorsToCheck } from "../dispatch";

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

async function dispatchedIds(now: Date) {
  const rows = await listMonitorsToCheck({ db, periodicity: "1h", now });
  return rows.filter((r) => r.workspaceId === workspaceId).map((r) => r.id);
}

describe("listMonitorsToCheck during maintenance", () => {
  const base = { periodicity: "1h" as const, active: true, regions: "ams" };

  test("a pause window excludes its monitors for [from, to)", async () => {
    const paused = await createMonitor(workspaceId, base);
    const unaffected = await createMonitor(workspaceId, base);
    const now = Date.now();
    const to = new Date(now + HOUR_MS);
    await createMaintenanceWindow(workspaceId, {
      monitorIds: [paused.id],
      mode: "pause",
      from: new Date(now - HOUR_MS),
      to,
    });

    const during = await dispatchedIds(new Date(now));
    expect(during).toContain(unaffected.id);
    expect(during).not.toContain(paused.id);
    expect(await dispatchedIds(to)).toContain(paused.id);
  });

  test("counts the monitors a pause window leaves out", async () => {
    const paused = await createMonitor(workspaceId, base);
    await createMonitor(workspaceId, base);
    // far from every other suite's windows, so the count is this one monitor
    const from = Date.UTC(2100, 0, 1);
    await createMaintenanceWindow(workspaceId, {
      monitorIds: [paused.id],
      mode: "pause",
      from: new Date(from),
      to: new Date(from + HOUR_MS),
    });

    expect(
      await countPausedMonitors({ db, periodicity: "1h", now: new Date(from) }),
    ).toBe(1);
    expect(
      await countPausedMonitors({
        db,
        periodicity: "1h",
        now: new Date(from + HOUR_MS),
      }),
    ).toBe(0);
  });

  test("a continue window does not exclude its monitors", async () => {
    const m = await createMonitor(workspaceId, base);
    const now = Date.now();
    await createMaintenanceWindow(workspaceId, {
      monitorIds: [m.id],
      mode: "continue",
      from: new Date(now - HOUR_MS),
      to: new Date(now + HOUR_MS),
    });

    expect(await dispatchedIds(new Date(now))).toContain(m.id);
  });

  test("a status-page maintenance excludes its monitors until the migration ends, end inclusive", async () => {
    const m = await createMonitor(workspaceId, base);
    const now = PAGE_MAINTENANCE_PAUSE_ENDS.getTime() - 24 * HOUR_MS;
    const to = new Date(now + HOUR_MS);
    await createPageMaintenance(workspaceId, pageId, {
      monitorId: m.id,
      from: new Date(now - HOUR_MS),
      to,
    });

    expect(await dispatchedIds(new Date(now))).not.toContain(m.id);
    expect(await dispatchedIds(to)).not.toContain(m.id);
    expect(await dispatchedIds(new Date(now + 2 * HOUR_MS))).toContain(m.id);
  });

  test("a status-page maintenance no longer excludes its monitors once the migration ends", async () => {
    const m = await createMonitor(workspaceId, base);
    const ends = PAGE_MAINTENANCE_PAUSE_ENDS.getTime();
    await createPageMaintenance(workspaceId, pageId, {
      monitorId: m.id,
      from: new Date(ends - HOUR_MS),
      to: new Date(ends + HOUR_MS),
    });

    expect(await dispatchedIds(new Date(ends - 1))).not.toContain(m.id);
    expect(await dispatchedIds(new Date(ends))).toContain(m.id);
  });

  test("a continue window wins over an overlapping status-page maintenance", async () => {
    const m = await createMonitor(workspaceId, base);
    const now = Date.now();
    const from = new Date(now - HOUR_MS);
    const to = new Date(now + HOUR_MS);
    await createPageMaintenance(workspaceId, pageId, {
      monitorId: m.id,
      from,
      to,
    });
    await createMaintenanceWindow(workspaceId, {
      monitorIds: [m.id],
      mode: "continue",
      from,
      to,
    });

    expect(await dispatchedIds(new Date(now))).toContain(m.id);
  });
});
