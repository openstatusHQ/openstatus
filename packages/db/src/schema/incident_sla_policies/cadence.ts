import type { IncidentEventType } from "../incidents/constants";
import {
  INCIDENT_SLA_WARNING_RATIO,
  type IncidentSlaFields,
  incidentSlaStopsResolution,
} from "./state";

const MINUTE = 60_000;

export const incidentSystemEventTypes = [
  "sla_response_breached",
  "sla_resolution_breached",
  "sla_update_missed",
] as const satisfies ReadonlyArray<IncidentEventType>;

export type IncidentSystemEventType = (typeof incidentSystemEventTypes)[number];

/** Events the system records for missed targets; never activity, never "Last update". */
export function isIncidentSystemEvent(
  type: string,
): type is IncidentSystemEventType {
  return incidentSystemEventTypes.some((t) => t === type);
}

/** What restarts the update interval, besides the declare. */
export type IncidentUpdateActivity = {
  reportLinked: boolean;
  /** Creation time (not the editable date) of the newest update on the linked report. */
  reportUpdatedAt: Date | null;
  statusChangedAt: Date | null;
  /** Newest note, at the time it carries. */
  notedAt: Date | null;
};

export type IncidentUpdateCadenceFields = Pick<
  IncidentSlaFields,
  "status" | "severity" | "declaredAt" | "slaSnapshot" | "resolutionStoppedAt"
> & { closedAt: Date | null };

export type IncidentUpdateCadenceStatus = "running" | "at_risk" | "overdue";

export type IncidentUpdateCadence = {
  intervalMinutes: number;
  /** Where the current interval restarted. */
  startsAt: Date;
  dueAt: Date;
  warnAt: Date;
  status: IncidentUpdateCadenceStatus;
};

/** The update interval at `now`; null when the cadence is not active. */
export function incidentUpdateCadence(
  incident: IncidentUpdateCadenceFields,
  activity: IncidentUpdateActivity,
  now: Date,
): IncidentUpdateCadence | null {
  const snapshot = incident.slaSnapshot;
  if (!snapshot || incident.closedAt) return null;
  if (incident.status !== "open" && incident.status !== "mitigated") {
    return null;
  }
  if (
    incident.resolutionStoppedAt ||
    incidentSlaStopsResolution(snapshot.resolutionStop, incident.status)
  ) {
    return null;
  }
  const intervalMinutes = snapshot.targets[incident.severity]?.updateMinutes;
  if (!intervalMinutes) return null;

  // declare, not the reported-at clock start: the interval is about communication
  const candidates = [
    incident.declaredAt,
    activity.reportUpdatedAt,
    activity.statusChangedAt,
    activity.reportLinked ? null : activity.notedAt,
  ];
  const startsAt = new Date(
    Math.max(...candidates.flatMap((d) => (d ? [d.getTime()] : []))),
  );
  const span = intervalMinutes * MINUTE;
  const dueAt = new Date(startsAt.getTime() + span);
  const warnAt = new Date(
    startsAt.getTime() + span * INCIDENT_SLA_WARNING_RATIO,
  );
  const status: IncidentUpdateCadenceStatus =
    now.getTime() > dueAt.getTime()
      ? "overdue"
      : now.getTime() >= warnAt.getTime()
        ? "at_risk"
        : "running";
  return { intervalMinutes, startsAt, dueAt, warnAt, status };
}

/**
 * Due times of the fully elapsed intervals since the restart, oldest first:
 * each one is a missed update. `after` skips due times already recorded.
 */
export function incidentMissedUpdates(
  cadence: Pick<IncidentUpdateCadence, "intervalMinutes" | "startsAt">,
  now: Date,
  options: { after?: Date; limit?: number } = {},
): Date[] {
  const span = cadence.intervalMinutes * MINUTE;
  const start = cadence.startsAt.getTime();
  const elapsed = Math.ceil((now.getTime() - start) / span) - 1;
  const first = options.after
    ? Math.max(1, Math.floor((options.after.getTime() - start) / span) + 1)
    : 1;
  const last = Math.min(
    elapsed,
    first + (options.limit ?? Number.POSITIVE_INFINITY) - 1,
  );
  const dueTimes: Date[] = [];
  for (let k = first; k <= last; k++) {
    dueTimes.push(new Date(start + k * span));
  }
  return dueTimes;
}
