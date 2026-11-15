import { and, db as defaultDb, eq, schema } from "@openstatus/db";
import { monitorInMaintenance } from "@openstatus/db/src/maintenance";

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
