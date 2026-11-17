import { and, eq, gt, inArray, lte, type SQL, sql } from "drizzle-orm";

import type { db as defaultDb } from "./db";
import * as schema from "./schema";
import type { MonitorMaintenanceWindowMode } from "./schema";

type Db = Pick<typeof defaultDb, "select">;

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
 * Condition on `monitor.id`: a maintenance window in `mode` covers the monitor
 * at `at`, active over [from, to). Windows are the only source: a status-page
 * maintenance pauses monitors through its derived window.
 * `continue` wins over any overlapping `pause`; `any` matches either mode.
 */
export function monitorInMaintenance(
  db: Db,
  args: { at: Date; mode: MonitorMaintenanceWindowMode | "any" },
): SQL {
  const id = schema.monitor.id;
  const continued = inArray(id, windowMonitorIds(db, args.at, "continue"));
  if (args.mode === "continue") return continued;
  const paused = inArray(id, windowMonitorIds(db, args.at, "pause"));
  if (args.mode === "any") return sql`(${continued} or ${paused})`;
  return sql`(${paused} and not ${continued})`;
}

export type ActiveMaintenance = {
  mode: MonitorMaintenanceWindowMode;
  /** latest end among the windows in that mode, exclusive */
  until: Date;
};

/** Per monitor, the window it is in at `at`, by the same rules as `monitorInMaintenance`. */
export async function activeMaintenanceByMonitor(
  db: Db,
  workspaceId: number,
  monitorIds: readonly number[],
  at: Date,
): Promise<Map<number, ActiveMaintenance>> {
  const out = new Map<number, ActiveMaintenance>();
  if (monitorIds.length === 0) return out;
  const w = schema.monitorMaintenanceWindow;
  const link = schema.monitorMaintenanceWindowToMonitor;
  const windows = await db
    .select({ monitorId: link.monitorId, mode: w.mode, to: w.to })
    .from(link)
    .innerJoin(w, eq(w.id, link.monitorMaintenanceWindowId))
    .where(
      and(
        eq(w.workspaceId, workspaceId),
        inArray(link.monitorId, [...monitorIds]),
        lte(w.from, at),
        gt(w.to, at),
      ),
    );
  for (const r of windows) {
    const prev = out.get(r.monitorId);
    const wins =
      !prev ||
      (prev.mode === "pause" && r.mode === "continue") ||
      (prev.mode === r.mode && prev.until < r.to);
    if (wins) out.set(r.monitorId, { mode: r.mode, until: r.to });
  }
  return out;
}
