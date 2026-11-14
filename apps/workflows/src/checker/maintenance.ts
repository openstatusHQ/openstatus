import {
  and,
  db as defaultDb,
  eq,
  gt,
  inArray,
  isNotNull,
  lte,
  notInArray,
  schema,
  type SQL,
  sql,
} from "@openstatus/db";
import type { MonitorMaintenanceWindowMode } from "@openstatus/db/src/schema";

type Db = Pick<typeof defaultDb, "select">;

/** A maintenance is active from `from` up to, but not including, `to`. */
export function maintenanceActiveAt(at: Date) {
  return and(lte(schema.maintenance.from, at), gt(schema.maintenance.to, at));
}

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
        and(maintenanceActiveAt(at), isNotNull(schema.pageComponent.monitorId)),
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

/**
 * Condition on `monitor.id`: the monitor is in maintenance at `at` in `mode`.
 * Page maintenances pause; a `continue` window wins over any overlapping pause.
 * `any` matches either mode.
 */
export function monitorInMaintenance(
  db: Db,
  args: { at: Date; mode: MonitorMaintenanceWindowMode | "any" },
): SQL {
  const id = schema.monitor.id;
  const continued = inArray(id, windowMonitorIds(db, args.at, "continue"));
  if (args.mode === "continue") return continued;
  const paused = sql`(${inArray(id, pageMaintenanceMonitorIds(db, args.at))} or ${inArray(id, windowMonitorIds(db, args.at, "pause"))})`;
  if (args.mode === "any") return sql`(${continued} or ${paused})`;
  return sql`(${paused} and ${notInArray(id, windowMonitorIds(db, args.at, "continue"))})`;
}

/** True when the monitor was under a `continue` maintenance when its check ran. */
export async function isInContinuedMaintenance(
  monitorId: number,
  ranAt: Date,
): Promise<boolean> {
  const row = await defaultDb
    .select({ id: schema.monitor.id })
    .from(schema.monitor)
    .where(
      and(
        eq(schema.monitor.id, monitorId),
        monitorInMaintenance(defaultDb, { at: ranAt, mode: "continue" }),
      ),
    )
    .get();
  return row !== undefined;
}
