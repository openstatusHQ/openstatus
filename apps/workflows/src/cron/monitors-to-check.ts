import { type db as defaultDb, and, eq, ne, not } from "@openstatus/db";
import { monitorInMaintenance } from "@openstatus/db/src/maintenance";
import { monitor } from "@openstatus/db/src/schema";
import type { MonitorPeriodicity } from "@openstatus/db/src/schema";

/** Monitors the cron dispatches for a periodicity, minus those in a pause-mode maintenance. */
export function listMonitorsToCheck(
  db: Pick<typeof defaultDb, "select">,
  periodicity: MonitorPeriodicity,
  now: Date = new Date(),
) {
  return db
    .select()
    .from(monitor)
    .where(
      and(
        eq(monitor.periodicity, periodicity),
        eq(monitor.active, true),
        ne(monitor.jobType, "heartbeat"),
        not(monitorInMaintenance(db, { at: now, mode: "pause" })),
      ),
    )
    .all();
}
