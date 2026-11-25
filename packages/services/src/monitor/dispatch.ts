import {
  and,
  count,
  db as defaultDb,
  eq,
  inArray,
  ne,
  not,
} from "@openstatus/db";
import { monitorInMaintenance } from "@openstatus/db/src/maintenance";
import {
  type MonitorPeriodicity,
  monitor,
  monitorStatusTable,
} from "@openstatus/db/src/schema";

import type { DrizzleClient } from "../context";

type ReadDb = Pick<DrizzleClient, "select">;

function scheduled(periodicity: MonitorPeriodicity) {
  return [
    eq(monitor.periodicity, periodicity),
    eq(monitor.active, true),
    ne(monitor.jobType, "heartbeat"),
  ];
}

/**
 * Monitors the checker cron dispatches for a periodicity, across workspaces,
 * minus those in a pause-mode maintenance.
 */
export async function listMonitorsToCheck(args: {
  periodicity: MonitorPeriodicity;
  now?: Date;
  db?: ReadDb;
}) {
  const db = args.db ?? defaultDb;
  const now = args.now ?? new Date();
  return db
    .select()
    .from(monitor)
    .where(
      and(
        ...scheduled(args.periodicity),
        not(monitorInMaintenance(db, { at: now, mode: "pause" })),
      ),
    )
    .all();
}

/** How many monitors `listMonitorsToCheck` leaves out for a pause-mode maintenance. */
export async function countPausedMonitors(args: {
  periodicity: MonitorPeriodicity;
  now?: Date;
  db?: ReadDb;
}): Promise<number> {
  const db = args.db ?? defaultDb;
  const now = args.now ?? new Date();
  const row = await db
    .select({ count: count() })
    .from(monitor)
    .where(
      and(
        ...scheduled(args.periodicity),
        monitorInMaintenance(db, { at: now, mode: "pause" }),
      ),
    )
    .get();
  return row?.count ?? 0;
}

/** Raw per-region status rows of the given monitors, unparsed. */
export async function listMonitorRegionStatuses(args: {
  monitorIds: number[];
  db?: ReadDb;
}) {
  const db = args.db ?? defaultDb;
  return db
    .select()
    .from(monitorStatusTable)
    .where(inArray(monitorStatusTable.monitorId, args.monitorIds))
    .all();
}
