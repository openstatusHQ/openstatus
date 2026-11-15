import { and, db as defaultDb, eq, schema } from "@openstatus/db";
import { monitorInMaintenance } from "@openstatus/db/src/maintenance";

/** True when the monitor was in any maintenance when its check ran: no status change, no alert. */
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
        monitorInMaintenance(defaultDb, { at: ranAt, mode: "any" }),
      ),
    )
    .get();
  return row !== undefined;
}
