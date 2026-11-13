import { and, count, eq, gte, isNotNull, lt, ne } from "@openstatus/db";
import {
  incident,
  incidentEvent,
  incidentSlaClockStart,
  incidentSlaState,
  type IncidentSlaTimer,
} from "@openstatus/db/src/schema";

import { requireScope } from "../auth";
import { getReadDb, type ServiceContext } from "../context";
import { assertIncidentSlaLimit } from "./internal";

const MONTHS = 12;
// a reported-at time may precede the declare by up to 30 days
const CLOCK_START_LEAD_MS = 31 * 24 * 60 * 60 * 1000;

export type IncidentSlaAttainmentCount = {
  within: number;
  missed: number;
  open: number;
  /** Incidents whose severity has this target. */
  total: number;
};

export type IncidentSlaAttainmentMonth = {
  /** YYYY-MM-01, UTC. */
  month: string;
  incidents: number;
  response: IncidentSlaAttainmentCount;
  resolution: IncidentSlaAttainmentCount;
  missedUpdates: number;
};

function monthKey(date: Date) {
  return `${date.toISOString().slice(0, 7)}-01`;
}

function tally(
  counts: IncidentSlaAttainmentCount,
  timer: IncidentSlaTimer | null,
) {
  if (!timer) return;
  counts.total++;
  // a running target past due but not stamped yet is still open
  if (timer.breachDueAt) counts.missed++;
  else if (timer.status === "met") counts.within++;
  else counts.open++;
}

/** Tracked incidents per UTC month of their clock start, the current month last. */
export async function getIncidentSlaAttainment(args: {
  ctx: ServiceContext;
  now?: Date;
}): Promise<{ months: IncidentSlaAttainmentMonth[] }> {
  const { ctx, now = new Date() } = args;
  requireScope(ctx, "incidents:read");
  assertIncidentSlaLimit(ctx);
  const db = getReadDb(ctx);

  const from = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHS - 1), 1),
  );
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const months = new Map<string, IncidentSlaAttainmentMonth>();
  for (let i = 0; i < MONTHS; i++) {
    const month = monthKey(
      new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + i, 1)),
    );
    months.set(month, {
      month,
      incidents: 0,
      response: { within: 0, missed: 0, open: 0, total: 0 },
      resolution: { within: 0, missed: 0, open: 0, total: 0 },
      missedUpdates: 0,
    });
  }

  const inWindow = and(
    eq(incident.workspaceId, ctx.workspace.id),
    isNotNull(incident.slaSnapshot),
    ne(incident.status, "canceled"),
    gte(incident.declaredAt, from),
    lt(incident.declaredAt, new Date(to.getTime() + CLOCK_START_LEAD_MS)),
  );
  const [rows, misses] = await Promise.all([
    db.select().from(incident).where(inWindow).all(),
    db
      .select({ incidentId: incidentEvent.incidentId, missed: count() })
      .from(incidentEvent)
      .innerJoin(incident, eq(incidentEvent.incidentId, incident.id))
      .where(and(inWindow, eq(incidentEvent.type, "sla_update_missed")))
      .groupBy(incidentEvent.incidentId)
      .all(),
  ]);
  const missedByIncident = new Map(misses.map((m) => [m.incidentId, m.missed]));

  for (const row of rows) {
    const month = months.get(monthKey(incidentSlaClockStart(row)));
    const state = incidentSlaState(row, now);
    if (!month || !state) continue;
    month.incidents++;
    tally(month.response, state.response);
    tally(month.resolution, state.resolution);
    month.missedUpdates += missedByIncident.get(row.id) ?? 0;
  }

  return { months: [...months.values()] };
}
