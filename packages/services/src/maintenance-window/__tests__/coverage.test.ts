import {
  createMaintenanceWindow,
  createMonitor,
  createPage,
  createPageMaintenance,
} from "@openstatus/db/src/test/factories";
import { beforeAll, describe, expect, test } from "vitest";

import {
  type WorkspaceFixture,
  createWorkspaceFixture,
  withTestTransaction,
} from "../../../test/helpers";
import {
  isMonitorInAnyMaintenance,
  isMonitorInMaintenanceWindow,
} from "../index.ts";

const HOUR_MS = 3_600_000;
// Before PAGE_MAINTENANCE_PAUSE_ENDS, while status-page maintenances still pause.
const AT = new Date("2026-06-01T12:00:00.000Z");

let fixture: WorkspaceFixture;

beforeAll(async () => {
  fixture = await createWorkspaceFixture();
});

describe("maintenance coverage", () => {
  test("a window covers its half-open range in either mode", async () => {
    await withTestTransaction(async (tx) => {
      const wsId = fixture.workspace.id;
      const m = await createMonitor(wsId, {}, tx);
      const to = new Date(AT.getTime() + HOUR_MS);
      await createMaintenanceWindow(
        wsId,
        { monitorIds: [m.id], mode: "continue", from: AT, to },
        tx,
      );

      for (const check of [
        isMonitorInMaintenanceWindow,
        isMonitorInAnyMaintenance,
      ]) {
        expect(await check({ monitorId: m.id, at: AT, db: tx })).toBe(true);
        expect(
          await check({
            monitorId: m.id,
            at: new Date(to.getTime() - 1),
            db: tx,
          }),
        ).toBe(true);
        expect(await check({ monitorId: m.id, at: to, db: tx })).toBe(false);
      }
    });
  });

  test("a status-page maintenance counts only towards any maintenance", async () => {
    await withTestTransaction(async (tx) => {
      const wsId = fixture.workspace.id;
      const m = await createMonitor(wsId, {}, tx);
      const page = await createPage(wsId, {}, tx);
      await createPageMaintenance(
        wsId,
        page.id,
        {
          monitorId: m.id,
          from: new Date(AT.getTime() - HOUR_MS),
          to: new Date(AT.getTime() + HOUR_MS),
        },
        tx,
      );

      const args = { monitorId: m.id, at: AT, db: tx };
      expect(await isMonitorInMaintenanceWindow(args)).toBe(false);
      expect(await isMonitorInAnyMaintenance(args)).toBe(true);
    });
  });

  test("a monitor without maintenance is covered by neither", async () => {
    await withTestTransaction(async (tx) => {
      const m = await createMonitor(fixture.workspace.id, {}, tx);
      const args = { monitorId: m.id, at: AT, db: tx };
      expect(await isMonitorInMaintenanceWindow(args)).toBe(false);
      expect(await isMonitorInAnyMaintenance(args)).toBe(false);
    });
  });
});
