import { and, eq } from "@openstatus/db";
import {
  auditLog,
  maintenance,
  maintenancesToPageComponents,
  monitor,
  monitorMaintenanceWindow,
  monitorMaintenanceWindowToMonitor,
  page,
  pageComponent,
} from "@openstatus/db/src/schema";
import { beforeAll, describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { ConflictError } from "../../errors";
import { createMaintenance } from "../../maintenance/create";
import { listMonitors } from "../../monitor/list";
import { createMaintenanceWindow } from "../create";
import { deleteMaintenanceWindow } from "../delete";
import { getMaintenanceWindow } from "../list";
import { endMaintenanceWindow, updateMaintenanceWindow } from "../update";

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
  test("reordering monitors is not an audit change", async () => {
    await withTestTransaction(async (tx) => {
      const a = await insertMonitor(tx, ctx.workspace.id);
      const b = await insertMonitor(tx, ctx.workspace.id);
      const now = Date.now();
      const window = await createMaintenanceWindow({
        ctx: { ...ctx, db: tx },
        input: {
          title: "Upgrade",
          from: new Date(now + hour),
          to: new Date(now + 2 * hour),
          monitorIds: [a.id, b.id],
        },
      });
      await updateMaintenanceWindow({
        ctx: { ...ctx, db: tx },
        input: { id: window.id, monitorIds: [b.id, a.id] },
      });
      const row = await tx
        .select({ before: auditLog.before, after: auditLog.after })
        .from(auditLog)
        .where(
          and(
            eq(auditLog.action, "monitor_maintenance_window.update"),
            eq(auditLog.entityId, String(window.id)),
          ),
        )
        .get();
      expect(row).toBeUndefined();
      const rows = await tx
        .select({ monitorId: monitorMaintenanceWindowToMonitor.monitorId })
        .from(monitorMaintenanceWindowToMonitor)
        .where(
          eq(
            monitorMaintenanceWindowToMonitor.monitorMaintenanceWindowId,
            window.id,
          ),
        )
        .all();
      expect(rows.map((r) => r.monitorId).sort((x, y) => x - y)).toEqual(
        [a.id, b.id].sort((x, y) => x - y),
      );
    });
  });

  test("moving or ending a window leaves its announcements' times alone", async () => {
    await withTestTransaction(async (tx) => {
      const m = await insertMonitor(tx, ctx.workspace.id);
      const now = Math.floor(Date.now() / 1000) * 1000;
      const window = await createMaintenanceWindow({
        ctx: { ...ctx, db: tx },
        input: {
          title: "Upgrade",
          from: new Date(now - hour),
          to: new Date(now + 2 * hour),
          monitorIds: [m.id],
        },
      });
      const announcement = await tx
        .insert(maintenance)
        .values({
          workspaceId: ctx.workspace.id,
          title: "Upgrade",
          message: "",
          from: new Date(now - 2 * hour),
          to: new Date(now + 4 * hour),
          monitorMaintenanceWindowId: window.id,
        })
        .returning()
        .get();

      await updateMaintenanceWindow({
        ctx: { ...ctx, db: tx },
        input: { id: window.id, to: new Date(now + 3 * hour) },
      });
      await endMaintenanceWindow({
        ctx: { ...ctx, db: tx },
        input: { id: window.id },
      });

      const after = await tx
        .select()
        .from(maintenance)
        .where(eq(maintenance.id, announcement.id))
        .get();
      expect(after?.from).toEqual(announcement.from);
      expect(after?.to).toEqual(announcement.to);
      const audits = await tx
        .select({ id: auditLog.id })
        .from(auditLog)
        .where(
          and(
            eq(auditLog.action, "maintenance.update"),
            eq(auditLog.entityId, String(announcement.id)),
          ),
        )
        .all();
      expect(audits).toHaveLength(0);
    });
  });
});

describe("listMonitors maintenance", () => {
  test("reports the active window, continue over pause, latest end", async () => {
    await withTestTransaction(async (tx) => {
      const both = await insertMonitor(tx, ctx.workspace.id);
      const paused = await insertMonitor(tx, ctx.workspace.id);
      const later = await insertMonitor(tx, ctx.workspace.id);
      const now = Date.now();
      const window = async (
        mode: "pause" | "continue",
        from: number,
        to: number,
        monitorIds: number[],
      ) => {
        const w = await tx
          .insert(monitorMaintenanceWindow)
          .values({
            workspaceId: ctx.workspace.id,
            title: mode,
            mode,
            from: new Date(from),
            to: new Date(to),
          })
          .returning()
          .get();
        await tx.insert(monitorMaintenanceWindowToMonitor).values(
          monitorIds.map((monitorId) => ({
            monitorMaintenanceWindowId: w.id,
            monitorId,
          })),
        );
      };
      await window("pause", now - hour, now + 3 * hour, [both.id, paused.id]);
      await window("continue", now - hour, now + hour, [both.id]);
      await window("continue", now - hour, now + 2 * hour, [both.id]);
      await window("pause", now + hour, now + 2 * hour, [later.id]);

      const { items } = await listMonitors({
        ctx: { ...ctx, db: tx },
        input: { limit: 100, offset: 0, order: "asc" },
      });
      const of = (id: number) => items.find((m) => m.id === id)?.maintenance;
      expect(of(both.id)?.mode).toBe("continue");
      expect(of(both.id)?.until.getTime()).toBe(
        Math.floor((now + 2 * hour) / 1000) * 1000,
      );
      expect(of(paused.id)?.mode).toBe("pause");
      expect(of(later.id)).toBeNull();
    });
  });

  test("a status-page maintenance counts only through its derived window", async () => {
    await withTestTransaction(async (tx) => {
      const bare = await insertMonitor(tx, ctx.workspace.id);
      const derived = await insertMonitor(tx, ctx.workspace.id);
      const now = Date.now();
      const pageRow = await tx
        .insert(page)
        .values({
          workspaceId: ctx.workspace.id,
          title: "p",
          description: "",
          slug: `mw-derived-${now}`,
          customDomain: "",
        })
        .returning()
        .get();
      const component = async (monitorId: number) =>
        tx
          .insert(pageComponent)
          .values({
            workspaceId: ctx.workspace.id,
            pageId: pageRow.id,
            name: "c",
            type: "monitor",
            monitorId,
          })
          .returning()
          .get();
      const bareComponent = await component(bare.id);
      const derivedComponent = await component(derived.id);
      const range = { from: new Date(now - hour), to: new Date(now + hour) };
      // written past the services, as nothing may: no window, so no pause
      const orphan = await tx
        .insert(maintenance)
        .values({
          workspaceId: ctx.workspace.id,
          pageId: pageRow.id,
          title: "orphan",
          message: "",
          ...range,
        })
        .returning()
        .get();
      await tx.insert(maintenancesToPageComponents).values({
        maintenanceId: orphan.id,
        pageComponentId: bareComponent.id,
      });
      await createMaintenance({
        ctx: { ...ctx, db: tx },
        input: {
          title: "announced",
          message: "m",
          ...range,
          pageId: pageRow.id,
          pageComponentIds: [derivedComponent.id],
        },
      });

      const { items } = await listMonitors({
        ctx: { ...ctx, db: tx },
        input: { limit: 100, offset: 0, order: "asc" },
      });
      const of = (id: number) => items.find((i) => i.id === id)?.maintenance;
      expect(of(bare.id)).toBeNull();
      expect(of(derived.id)?.mode).toBe("pause");
    });
  });
});
