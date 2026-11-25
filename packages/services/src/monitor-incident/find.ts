import { and, db as defaultDb, eq, isNull } from "@openstatus/db";
import { monitorIncidentTable } from "@openstatus/db/src/schema";

import type { DB } from "../context";

// No workspace filter: the checker holds a monitor or incident id and nothing else.

/** The monitor's unresolved incident, if any. */
export async function findOpenMonitorIncident(args: {
  monitorId: number;
  db?: DB;
}) {
  return (args.db ?? defaultDb)
    .select()
    .from(monitorIncidentTable)
    .where(
      and(
        eq(monitorIncidentTable.monitorId, args.monitorId),
        isNull(monitorIncidentTable.resolvedAt),
      ),
    )
    .get();
}

export async function findMonitorIncident(args: { id: number; db?: DB }) {
  return (args.db ?? defaultDb).query.monitorIncidentTable.findFirst({
    where: eq(monitorIncidentTable.id, args.id),
  });
}
