import { and, eq, inArray } from "@openstatus/db";
import { monitorInMaintenance } from "@openstatus/db/src/maintenance";
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
  expectAuditRow,
  makeApiKeyCtx,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { ConflictError, ForbiddenError, NotFoundError } from "../../errors";
import { listMonitors } from "../../monitor/list";
import { createMaintenanceWindow } from "../create";
import { deleteMaintenanceWindow } from "../delete";
import { getMaintenanceWindow, listMaintenanceWindows } from "../list";
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

async function pageMaintenance(
  tx: Tx,
  monitorIds: number[],
  range: { from: Date; to: Date },
) {
  const pageRow = await tx
    .insert(page)
    .values({
      workspaceId: ctx.workspace.id,
      title: "p",
      description: "",
      slug: `mw-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      customDomain: "",
    })
    .returning()
    .get();
  const m = await tx
    .insert(maintenance)
    .values({
      workspaceId: ctx.workspace.id,
      pageId: pageRow.id,
      title: "status page",
      message: "",
      ...range,
    })
    .returning()
    .get();
  for (const monitorId of monitorIds) {
    const component = await tx
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
    await tx.insert(maintenancesToPageComponents).values({
      maintenanceId: m.id,
      pageComponentId: component.id,
    });
  }
}

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

      const byMonitor = (monitorId: number) =>
        listMaintenanceWindows({
          ctx: { ...ctx, db: tx },
          input: { monitorId },
        }).then((rows) => rows.map((row) => row.id));
      expect(await byMonitor(own.id)).toEqual([window.id]);
      expect(await byMonitor(gone.id)).toEqual([]);
      expect(await byMonitor(foreign.id)).toEqual([]);
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

  test("validation: end before start and foreign monitors are refused", async () => {
    await withTestTransaction(async (tx) => {
      const own = await insertMonitor(tx, ctx.workspace.id);
      const foreign = await insertMonitor(tx, otherCtx.workspace.id);
      const now = Date.now();
      await expect(
        createMaintenanceWindow({
          ctx: { ...ctx, db: tx },
          input: {
            title: "Upgrade",
            from: new Date(now + 2 * hour),
            to: new Date(now + hour),
            monitorIds: [own.id],
          },
        }),
      ).rejects.toThrow();
      await expect(
        createMaintenanceWindow({
          ctx: { ...ctx, db: tx },
          input: {
            title: "Upgrade",
            from: new Date(now + hour),
            to: new Date(now + 2 * hour),
            monitorIds: [foreign.id],
          },
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
      await expect(
        getMaintenanceWindow({
          ctx: { ...otherCtx, db: tx },
          input: {
            id: (
              await createMaintenanceWindow({
                ctx: { ...ctx, db: tx },
                input: {
                  title: "Upgrade",
                  from: new Date(now + hour),
                  to: new Date(now + 2 * hour),
                  monitorIds: [own.id],
                },
              })
            ).id,
          },
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  test("create, update and list write audit rows", async () => {
    await withTestTransaction(async (tx) => {
      const m = await insertMonitor(tx, ctx.workspace.id);
      const now = Date.now();
      const window = await createMaintenanceWindow({
        ctx: { ...ctx, db: tx },
        input: {
          title: "Upgrade",
          mode: "continue",
          from: new Date(now + hour),
          to: new Date(now + 2 * hour),
          monitorIds: [m.id],
        },
      });
      await expectAuditRow({
        workspaceId: ctx.workspace.id,
        action: "monitor_maintenance_window.create",
        entityType: "monitor_maintenance_window",
        entityId: window.id,
        db: tx,
      });
      await updateMaintenanceWindow({
        ctx: { ...ctx, db: tx },
        input: { id: window.id, title: "Renamed" },
      });
      await expectAuditRow({
        workspaceId: ctx.workspace.id,
        action: "monitor_maintenance_window.update",
        entityType: "monitor_maintenance_window",
        entityId: window.id,
        db: tx,
      });
      const listed = await listMaintenanceWindows({
        ctx: { ...ctx, db: tx },
        input: { monitorId: m.id },
      });
      expect(listed.map((w) => [w.id, w.title, w.mode])).toEqual([
        [window.id, "Renamed", "continue"],
      ]);
    });
  });

  test("a completed window can no longer be changed", async () => {
    await withTestTransaction(async (tx) => {
      const m = await insertMonitor(tx, ctx.workspace.id);
      const now = Date.now();
      const window = await createMaintenanceWindow({
        ctx: { ...ctx, db: tx },
        input: {
          title: "Done",
          from: new Date(now - 2 * hour),
          to: new Date(now - hour),
          monitorIds: [m.id],
        },
      });

      await expect(
        updateMaintenanceWindow({
          ctx: { ...ctx, db: tx },
          input: { id: window.id, to: new Date(now + hour) },
        }),
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  test("rejects read-only actor", async () => {
    const readOnlyCtx = makeApiKeyCtx(ctx.workspace, {
      keyId: "k-read",
      userId: 1,
      scopes: ["read"],
    });
    const now = Date.now();
    await expect(
      createMaintenanceWindow({
        ctx: readOnlyCtx,
        input: {
          title: "x",
          from: new Date(now),
          to: new Date(now + hour),
          monitorIds: [1],
        },
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      updateMaintenanceWindow({ ctx: readOnlyCtx, input: { id: 1 } }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      deleteMaintenanceWindow({ ctx: readOnlyCtx, input: { id: 1 } }),
    ).rejects.toBeInstanceOf(ForbiddenError);
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

  test("a status-page maintenance shows as pause; a continue window wins over it", async () => {
    await withTestTransaction(async (tx) => {
      const paused = await insertMonitor(tx, ctx.workspace.id);
      const continued = await insertMonitor(tx, ctx.workspace.id);
      const now = Date.now();
      const range = { from: new Date(now - hour), to: new Date(now + hour) };
      await pageMaintenance(tx, [paused.id, continued.id], range);
      await createMaintenanceWindow({
        ctx: { ...ctx, db: tx },
        input: {
          title: "c",
          mode: "continue",
          ...range,
          monitorIds: [continued.id],
        },
      });

      const { items } = await listMonitors({
        ctx: { ...ctx, db: tx },
        input: { limit: 100, offset: 0, order: "asc" },
      });
      const of = (id: number) => items.find((i) => i.id === id)?.maintenance;
      expect(of(paused.id)).toMatchObject({
        mode: "pause",
        source: "status_page",
      });
      expect(of(continued.id)).toMatchObject({
        mode: "continue",
        source: "window",
      });
    });
  });
});

describe("monitorInMaintenance", () => {
  test("pause is the union of pause windows and status-page maintenances, minus continue windows", async () => {
    await withTestTransaction(async (tx) => {
      const byWindow = await insertMonitor(tx, ctx.workspace.id);
      const byPage = await insertMonitor(tx, ctx.workspace.id);
      const both = await insertMonitor(tx, ctx.workspace.id);
      const overridden = await insertMonitor(tx, ctx.workspace.id);
      const free = await insertMonitor(tx, ctx.workspace.id);
      const ids = [byWindow.id, byPage.id, both.id, overridden.id, free.id];
      const now = Date.now();
      const range = { from: new Date(now - hour), to: new Date(now + hour) };
      await createMaintenanceWindow({
        ctx: { ...ctx, db: tx },
        input: { title: "p", ...range, monitorIds: [byWindow.id, both.id] },
      });
      await pageMaintenance(tx, [byPage.id, both.id, overridden.id], range);
      await createMaintenanceWindow({
        ctx: { ...ctx, db: tx },
        input: {
          title: "c",
          mode: "continue",
          ...range,
          monitorIds: [overridden.id],
        },
      });

      const matching = async (mode: "pause" | "continue" | "window") => {
        const rows = await tx
          .select({ id: monitor.id })
          .from(monitor)
          .where(
            and(
              inArray(monitor.id, ids),
              monitorInMaintenance(tx, { at: new Date(now), mode }),
            ),
          )
          .all();
        return rows.map((r) => r.id).sort((x, y) => x - y);
      };
      const sorted = (xs: number[]) => [...xs].sort((x, y) => x - y);
      expect(await matching("pause")).toEqual(
        sorted([byWindow.id, byPage.id, both.id]),
      );
      expect(await matching("continue")).toEqual([overridden.id]);
      expect(await matching("window")).toEqual(
        sorted([byWindow.id, both.id, overridden.id]),
      );
    });
  });

  test("windows end exclusively, status-page maintenances inclusively", async () => {
    await withTestTransaction(async (tx) => {
      const byWindow = await insertMonitor(tx, ctx.workspace.id);
      const byPage = await insertMonitor(tx, ctx.workspace.id);
      const end = Math.floor(Date.now() / 1000) * 1000;
      const range = { from: new Date(end - hour), to: new Date(end) };
      await createMaintenanceWindow({
        ctx: { ...ctx, db: tx },
        input: { title: "p", ...range, monitorIds: [byWindow.id] },
      });
      await pageMaintenance(tx, [byPage.id], range);
      const rows = await tx
        .select({ id: monitor.id })
        .from(monitor)
        .where(
          and(
            inArray(monitor.id, [byWindow.id, byPage.id]),
            monitorInMaintenance(tx, { at: new Date(end), mode: "pause" }),
          ),
        )
        .all();
      expect(rows.map((r) => r.id)).toEqual([byPage.id]);
    });
  });
});
