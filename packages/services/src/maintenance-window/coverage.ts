import { and, db as defaultDb, eq, or } from "@openstatus/db";
import {
  monitorInMaintenance,
  monitorInWindow,
} from "@openstatus/db/src/maintenance";
import { monitor } from "@openstatus/db/src/schema";

import type { DB } from "../context";

/** True when a maintenance window of either mode covers the monitor at `at`. */
export async function isMonitorInMaintenanceWindow(args: {
  monitorId: number;
  at: Date;
  db?: DB;
}): Promise<boolean> {
  const db = args.db ?? defaultDb;
  const row = await db
    .select({ id: monitor.id })
    .from(monitor)
    .where(and(eq(monitor.id, args.monitorId), monitorInWindow(db, args.at)))
    .get();
  return row !== undefined;
}

/**
 * True when a window of either mode, or a pausing status-page maintenance,
 * covers the monitor at `at`.
 */
export async function isMonitorInAnyMaintenance(args: {
  monitorId: number;
  at: Date;
  db?: DB;
}): Promise<boolean> {
  const db = args.db ?? defaultDb;
  const row = await db
    .select({ id: monitor.id })
    .from(monitor)
    .where(
      and(
        eq(monitor.id, args.monitorId),
        or(
          monitorInMaintenance(db, { at: args.at, mode: "pause" }),
          monitorInWindow(db, args.at),
        ),
      ),
    )
    .get();
  return row !== undefined;
}
