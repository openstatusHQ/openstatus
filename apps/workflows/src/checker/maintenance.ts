import { and, db as defaultDb, eq, schema } from "@openstatus/db";
import { monitorInMaintenance } from "@openstatus/db/src/maintenance";

/** True when a maintenance window of either mode covered the monitor when its check ran. */
export async function isInMaintenance(
  monitorId: number,
  ranAt: Date,
): Promise<boolean> {
  const row = await defaultDb
    .select({ id: schema.monitor.id })
    .from(schema.monitor)
    .where(
      and(
        eq(schema.monitor.id, monitorId),
        monitorInMaintenance(defaultDb, { at: ranAt, mode: "window" }),
      ),
    )
    .get();
  return row !== undefined;
}
