import { type db as defaultDb, and, eq, ne, notInArray } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";
import type { MonitorPeriodicity } from "@openstatus/db/src/schema";

import { monitorsInMaintenance } from "../checker/maintenance";

/** Monitors the cron dispatches for a periodicity; maintenance pauses only those set to "pause". */
export function listMonitorsToCheck(
  db: Pick<typeof defaultDb, "select">,
  periodicity: MonitorPeriodicity,
  now: Date = new Date(),
) {
  const pausedMonitors = monitorsInMaintenance(db, { at: now, mode: "pause" });

  return db
    .select()
    .from(monitor)
    .where(
      and(
        eq(monitor.periodicity, periodicity),
        eq(monitor.active, true),
        ne(monitor.jobType, "heartbeat"),
        notInArray(monitor.id, pausedMonitors),
      ),
    )
    .all();
}
