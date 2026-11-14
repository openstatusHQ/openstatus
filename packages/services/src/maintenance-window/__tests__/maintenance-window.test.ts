import { and, eq } from "@openstatus/db";
import {
  auditLog,
  monitor,
  monitorMaintenanceWindowToMonitor,
} from "@openstatus/db/src/schema";
import { beforeAll, describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { ConflictError } from "../../errors";
import { createMaintenanceWindow } from "../create";
import { deleteMaintenanceWindow } from "../delete";
import { getMaintenanceWindow } from "../list";
import { endMaintenanceWindow } from "../update";

let ctx: ServiceContext;
let otherCtx: ServiceContext;

beforeAll(async () => {
  const team = await createWorkspaceFixture("team");
  ctx = makeUserCtx(team.workspace, { userId: team.userId });
  const other = await createWorkspaceFixture("team");
  otherCtx = makeUserCtx(other.workspace, { userId: other.userId });
});

type Tx = Parameters<Parameters<typeof withTestTransaction>[0]>[0];

async function insertMonitor(
  tx: Tx,
  workspaceId: number,
  overrides: Partial<typeof monitor.$inferInsert> = {},
) {
  return tx
    .insert(monitor)
    .values({
      workspaceId,
      active: true,
      url: "https://example.com",
      name: "svc-maintenance-window",
      periodicity: "10m",
      regions: "ams",
      jobType: "http",
      ...overrides,
    })
    .returning()
    .get();
}

const hour = 60 * 60 * 1000;

describe("maintenance windows", () => {
  test("monitors outside the workspace or soft-deleted are not listed", async () => {
    await withTestTransaction(async (tx) => {
      const own = await insertMonitor(tx, ctx.workspace.id);
      const gone = await insertMonitor(tx, ctx.workspace.id);
      const foreign = await insertMonitor(tx, otherCtx.workspace.id);
      const now = Date.now();
      const window = await createMaintenanceWindow({
        ctx: { ...ctx, db: tx },
        input: {
          title: "Upgrade",
          from: new Date(now + hour),
          to: new Date(now + 2 * hour),
          monitorIds: [own.id, gone.id],
        },
      });
      await tx
        .update(monitor)
        .set({ deletedAt: new Date() })
        .where(eq(monitor.id, gone.id));
      await tx.insert(monitorMaintenanceWindowToMonitor).values({
        monitorMaintenanceWindowId: window.id,
        monitorId: foreign.id,
      });

      const got = await getMaintenanceWindow({
        ctx: { ...ctx, db: tx },
        input: { id: window.id },
      });
      expect(got.monitorIds).toEqual([own.id]);
    });
  });

  test("delete audit keeps the monitor ids", async () => {
    await withTestTransaction(async (tx) => {
      const m = await insertMonitor(tx, ctx.workspace.id);
      const now = Date.now();
      const window = await createMaintenanceWindow({
        ctx: { ...ctx, db: tx },
        input: {
          title: "Upgrade",
          from: new Date(now + hour),
          to: new Date(now + 2 * hour),
          monitorIds: [m.id],
        },
      });
      await deleteMaintenanceWindow({
        ctx: { ...ctx, db: tx },
        input: { id: window.id },
      });
      const row = await tx
        .select({ before: auditLog.before })
        .from(auditLog)
        .where(
          and(
            eq(auditLog.action, "monitor_maintenance_window.delete"),
            eq(auditLog.entityId, String(window.id)),
          ),
        )
        .get();
      expect(row?.before?.monitorIds).toEqual([m.id]);
    });
  });

  test("ending at the exact start is refused", async () => {
    await withTestTransaction(async (tx) => {
      const m = await insertMonitor(tx, ctx.workspace.id);
      const from = new Date(Date.now() + hour);
      const window = await createMaintenanceWindow({
        ctx: { ...ctx, db: tx },
        input: {
          title: "Upgrade",
          from,
          to: new Date(from.getTime() + hour),
          monitorIds: [m.id],
        },
      });
      await expect(
        endMaintenanceWindow({
          ctx: { ...ctx, db: tx },
          input: { id: window.id },
          now: window.from,
        }),
      ).rejects.toBeInstanceOf(ConflictError);

      const ended = await endMaintenanceWindow({
        ctx: { ...ctx, db: tx },
        input: { id: window.id },
        now: new Date(from.getTime() + 1000),
      });
      expect(ended.to.getTime()).toBeGreaterThan(ended.from.getTime());
    });
  });
});
