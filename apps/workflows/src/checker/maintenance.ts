import {
  and,
  db as defaultDb,
  eq,
  gte,
  lte,
  schema,
  type SQL,
} from "@openstatus/db";

/** Monitors on a status page component under a maintenance active at `at`, in one maintenance mode. */
export function monitorsInMaintenance(
  db: Pick<typeof defaultDb, "select">,
  args: { at: Date; mode: "pause" | "continue"; where?: SQL },
) {
  return db
    .select({ id: schema.monitor.id })
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
    .innerJoin(
      schema.monitor,
      eq(schema.monitor.id, schema.pageComponent.monitorId),
    )
    .where(
      and(
        eq(schema.monitor.maintenanceMode, args.mode),
        lte(schema.maintenance.from, args.at),
        gte(schema.maintenance.to, args.at),
        args.where,
      ),
    );
}

/** True when a monitor set to keep checking was under an active maintenance when its check ran. */
export async function isInContinuedMaintenance(
  monitorId: number,
  ranAt: Date,
): Promise<boolean> {
  const row = await monitorsInMaintenance(defaultDb, {
    at: ranAt,
    mode: "continue",
    where: eq(schema.monitor.id, monitorId),
  }).get();
  return row !== undefined;
}
