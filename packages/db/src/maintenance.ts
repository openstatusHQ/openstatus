import {
  and,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lte,
  type SQL,
  sql,
} from "drizzle-orm";

import type { db as defaultDb } from "./db";
import * as schema from "./schema";
import type { MonitorMaintenanceWindowMode } from "./schema";

type Db = Pick<typeof defaultDb, "select">;

/** A maintenance is active from `from` up to, but not including, `to`. */
export function maintenanceActiveAt(at: Date) {
  return and(lte(schema.maintenance.from, at), gt(schema.maintenance.to, at));
}

/** Monitors paused by unlinked status-page maintenances active at `at`, through their components. */
function pageMaintenanceMonitorIds(db: Db, at: Date) {
  return (
    db
      .select({ id: schema.pageComponent.monitorId })
      .from(schema.maintenance)
      .innerJoin(
        schema.maintenancesToPageComponents,
        eq(
          schema.maintenancesToPageComponents.maintenanceId,
          schema.maintenance.id,
        ),
      )
      .innerJoin(
        schema.pageComponent,
        eq(
          schema.pageComponent.id,
          schema.maintenancesToPageComponents.pageComponentId,
        ),
      )
      // a NULL in a NOT IN subquery would exclude every monitor
      .where(
        and(
          maintenanceActiveAt(at),
          // a linked maintenance follows its window, which is counted below
          isNull(schema.maintenance.monitorMaintenanceWindowId),
          isNotNull(schema.pageComponent.monitorId),
        ),
      )
  );
}

function windowMonitorIds(
  db: Db,
  at: Date,
  mode: MonitorMaintenanceWindowMode,
) {
  const w = schema.monitorMaintenanceWindow;
  return db
    .select({ id: schema.monitorMaintenanceWindowToMonitor.monitorId })
    .from(schema.monitorMaintenanceWindowToMonitor)
    .innerJoin(
      w,
      eq(
        w.id,
        schema.monitorMaintenanceWindowToMonitor.monitorMaintenanceWindowId,
      ),
    )
    .where(and(eq(w.mode, mode), lte(w.from, at), gt(w.to, at)));
}

function inMode(db: Db, at: Date, mode: MonitorMaintenanceWindowMode): SQL {
  const id = schema.monitor.id;
  const windows = inArray(id, windowMonitorIds(db, at, mode));
  if (mode === "continue") return windows;
  return sql`(${inArray(id, pageMaintenanceMonitorIds(db, at))} or ${windows})`;
}

/**
 * Condition on `monitor.id`: the monitor is in maintenance at `at` in `mode`,
 * from a window or an unlinked status-page maintenance (always pause).
 * `continue` wins over any overlapping `pause`; `any` matches either mode.
 */
export function monitorInMaintenance(
  db: Db,
  args: { at: Date; mode: MonitorMaintenanceWindowMode | "any" },
): SQL {
  const continued = inMode(db, args.at, "continue");
  if (args.mode === "continue") return continued;
  const paused = inMode(db, args.at, "pause");
  if (args.mode === "any") return sql`(${continued} or ${paused})`;
  return sql`(${paused} and not ${continued})`;
}

export type ActiveMaintenance = {
  mode: MonitorMaintenanceWindowMode;
  /** latest end among the maintenances in that mode, exclusive */
  until: Date;
};

/**
 * Per monitor, the maintenance it is in at `at`, by the same rules as
 * `monitorInMaintenance`: unlinked status-page maintenances pause, and
 * `continue` wins over an overlapping `pause`.
 */
export async function activeMaintenanceByMonitor(
  db: Db,
  monitorIds: readonly number[],
  at: Date,
): Promise<Map<number, ActiveMaintenance>> {
  const out = new Map<number, ActiveMaintenance>();
  if (monitorIds.length === 0) return out;
  const w = schema.monitorMaintenanceWindow;
  const link = schema.monitorMaintenanceWindowToMonitor;
  const [windows, pages] = await Promise.all([
    db
      .select({ monitorId: link.monitorId, mode: w.mode, to: w.to })
      .from(link)
      .innerJoin(w, eq(w.id, link.monitorMaintenanceWindowId))
      .where(
        and(
          inArray(link.monitorId, [...monitorIds]),
          lte(w.from, at),
          gt(w.to, at),
        ),
      ),
    db
      .select({
        monitorId: schema.pageComponent.monitorId,
        to: schema.maintenance.to,
      })
      .from(schema.maintenance)
      .innerJoin(
        schema.maintenancesToPageComponents,
        eq(
          schema.maintenancesToPageComponents.maintenanceId,
          schema.maintenance.id,
        ),
      )
      .innerJoin(
        schema.pageComponent,
        eq(
          schema.pageComponent.id,
          schema.maintenancesToPageComponents.pageComponentId,
        ),
      )
      .where(
        and(
          maintenanceActiveAt(at),
          isNull(schema.maintenance.monitorMaintenanceWindowId),
          inArray(schema.pageComponent.monitorId, [...monitorIds]),
        ),
      ),
  ]);
  const add = (
    monitorId: number,
    mode: MonitorMaintenanceWindowMode,
    until: Date,
  ) => {
    const prev = out.get(monitorId);
    const wins =
      !prev ||
      (prev.mode === "pause" && mode === "continue") ||
      (prev.mode === mode && prev.until < until);
    if (wins) out.set(monitorId, { mode, until });
  };
  for (const r of windows) add(r.monitorId, r.mode, r.to);
  for (const r of pages) {
    if (r.monitorId !== null) add(r.monitorId, "pause", r.to);
  }
  return out;
}
