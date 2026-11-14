import { and, inArray, sql } from "@openstatus/db";
import {
  type IncidentEventType,
  type IncidentUpdateActivity,
  incidentEvent,
  statusReportUpdate,
} from "@openstatus/db/src/schema";

import type { DB } from "../context";

const STATUS_CHANGE_TYPES = [
  "status_changed",
  "mitigated",
  "resolved",
  "canceled",
] as const satisfies ReadonlyArray<IncidentEventType>;

export function noUpdateActivity(row: {
  statusReportId: number | null;
}): IncidentUpdateActivity {
  return {
    reportLinked: row.statusReportId !== null,
    reportUpdatedAt: null,
    statusChangedAt: null,
    notedAt: null,
  };
}

const toDate = (seconds: number | null) =>
  seconds === null ? null : new Date(seconds * 1000);

/**
 * The inputs of `incidentUpdateCadence` per incident, in two queries. Callers
 * pass incidents already scoped to their workspace.
 */
export async function loadIncidentUpdateActivity(
  db: DB,
  incidents: ReadonlyArray<{ id: number; statusReportId: number | null }>,
): Promise<Map<number, IncidentUpdateActivity>> {
  const result = new Map(
    incidents.map((row) => [row.id, noUpdateActivity(row)]),
  );
  if (incidents.length === 0) return result;

  const events = await db
    .select({
      incidentId: incidentEvent.incidentId,
      type: incidentEvent.type,
      at: sql<number | null>`max(${incidentEvent.createdAt})`,
    })
    .from(incidentEvent)
    .where(
      and(
        inArray(
          incidentEvent.incidentId,
          incidents.map((row) => row.id),
        ),
        inArray(incidentEvent.type, [...STATUS_CHANGE_TYPES, "note"]),
      ),
    )
    .groupBy(incidentEvent.incidentId, incidentEvent.type)
    .all();
  for (const event of events) {
    const activity = result.get(event.incidentId);
    const at = toDate(event.at);
    if (!activity || !at) continue;
    if (event.type === "note") {
      activity.notedAt = at;
    } else if (
      !activity.statusChangedAt ||
      at.getTime() > activity.statusChangedAt.getTime()
    ) {
      activity.statusChangedAt = at;
    }
  }

  const reportIds = incidents.flatMap((row) =>
    row.statusReportId === null ? [] : [row.statusReportId],
  );
  if (reportIds.length === 0) return result;
  const updates = await db
    .select({
      statusReportId: statusReportUpdate.statusReportId,
      at: sql<number | null>`max(${statusReportUpdate.createdAt})`,
    })
    .from(statusReportUpdate)
    .where(inArray(statusReportUpdate.statusReportId, reportIds))
    .groupBy(statusReportUpdate.statusReportId)
    .all();
  const updatedAt = new Map(
    updates.map((row) => [row.statusReportId, toDate(row.at)]),
  );
  for (const row of incidents) {
    const activity = result.get(row.id);
    if (activity && row.statusReportId !== null) {
      activity.reportUpdatedAt = updatedAt.get(row.statusReportId) ?? null;
    }
  }
  return result;
}
