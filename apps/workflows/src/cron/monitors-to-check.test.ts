import { db, eq } from "@openstatus/db";
import {
  maintenance,
  maintenancesToPageComponents,
  monitor,
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

async function putUnderMaintenance(monitorId: number, from: Date, to: Date) {
  const component = await createPageComponent(workspaceId, pageId, {
    type: "monitor",
    monitorId,
  });
  const [window] = await db
    .insert(maintenance)
    .values({ title: "db upgrade", message: "", from, to, workspaceId, pageId })
    .returning();
  if (!window) throw new Error("maintenance insert returned no row");
  await db
    .insert(maintenancesToPageComponents)
    .values({ maintenanceId: window.id, pageComponentId: component.id })
    .run();
}

async function dispatchedIds(now: Date) {
  const rows = await listMonitorsToCheck(db, "1h", now);
  return rows.filter((r) => r.workspaceId === workspaceId).map((r) => r.id);
}

describe("listMonitorsToCheck during maintenance", () => {
  test("pauses a monitor set to pause and keeps one set to continue", async () => {
    const base = { periodicity: "1h" as const, active: true, regions: "ams" };
    const paused = await createMonitor(workspaceId, base);
    const continued = await createMonitor(workspaceId, {
      ...base,
      maintenanceMode: "continue",
    });
    const unaffected = await createMonitor(workspaceId, base);
    const now = Date.now();
    for (const m of [paused, continued]) {
      await putUnderMaintenance(
        m.id,
        new Date(now - HOUR_MS),
        new Date(now + HOUR_MS),
      );
    }

    const during = await dispatchedIds(new Date(now));
    expect(during).toContain(continued.id);
    expect(during).toContain(unaffected.id);
    expect(during).not.toContain(paused.id);

    const after = await dispatchedIds(new Date(now + 2 * HOUR_MS));
    expect(after).toContain(paused.id);
  });
});
