import type { IncidentSeverity, IncidentStatus } from "../incidents/constants";
import type { IncidentSlaResponseMet, IncidentSlaSnapshot } from "./constants";

export const INCIDENT_SLA_WARNING_RATIO = 0.75;

const MINUTE = 60_000;

export type IncidentSlaTimerStatus = "running" | "at_risk" | "met" | "breached";

export type IncidentSlaTimer = {
  targetMinutes: number;
  startsAt: Date;
  dueAt: Date;
  warnAt: Date;
  metAt: Date | null;
  /** The due time recorded as missed; once set it never clears. */
  breachDueAt: Date | null;
  /** Why the recorded miss happened; only ever set alongside `breachDueAt`. */
  missReason: string | null;
  status: IncidentSlaTimerStatus;
};

export type IncidentSlaState = {
  response: IncidentSlaTimer | null;
  resolution: IncidentSlaTimer | null;
  resolutionStop: IncidentSlaSnapshot["resolutionStop"];
  responseMet: IncidentSlaResponseMet;
};

export type IncidentSlaFields = {
  status: IncidentStatus;
  severity: IncidentSeverity;
  declaredAt: Date;
  reportedAt?: Date | null;
  slaSnapshot: IncidentSlaSnapshot | null;
  responseMetAt: Date | null;
  responseBreachDueAt: Date | null;
  resolutionStoppedAt: Date | null;
  resolutionBreachDueAt: Date | null;
  responseMissReason?: string | null;
  resolutionMissReason?: string | null;
};

export type IncidentAcknowledgeFields = IncidentSlaFields & {
  acknowledgedAt: Date | null;
  closedAt: Date | null;
};

/** What meets the response on this incident; resolving meets it in every mode. */
export function incidentSlaResponseMet(
  snapshot: IncidentSlaSnapshot | null,
): IncidentSlaResponseMet {
  return snapshot?.responseMet ?? "acknowledged";
}

export function incidentSlaClockStart(
  incident: Pick<IncidentSlaFields, "declaredAt" | "reportedAt">,
): Date {
  return incident.reportedAt ?? incident.declaredAt;
}

function timer(args: {
  startsAt: Date;
  targetMinutes: number | undefined;
  metAt: Date | null;
  breachDueAt: Date | null;
  missReason: string | null | undefined;
  now: Date;
}): IncidentSlaTimer | null {
  const { startsAt, metAt, breachDueAt, now } = args;
  const missReason = breachDueAt ? (args.missReason ?? null) : null;
  // a recorded miss outlives a severity change that dropped the target
  const targetMinutes =
    args.targetMinutes ??
    (breachDueAt
      ? Math.round((breachDueAt.getTime() - startsAt.getTime()) / MINUTE)
      : undefined);
  if (targetMinutes === undefined) return null;
  const span = targetMinutes * MINUTE;
  const dueAt = breachDueAt ?? new Date(startsAt.getTime() + span);
  const warnAt = new Date(
    startsAt.getTime() + span * INCIDENT_SLA_WARNING_RATIO,
  );
  const status: IncidentSlaTimerStatus = breachDueAt
    ? "breached"
    : metAt
      ? "met"
      : now.getTime() > dueAt.getTime()
        ? "breached"
        : now.getTime() >= warnAt.getTime()
          ? "at_risk"
          : "running";
  return {
    targetMinutes,
    startsAt,
    dueAt,
    warnAt,
    metAt,
    breachDueAt,
    missReason,
    status,
  };
}

/** A timer with ISO times, as the API and agents show it: the recorded miss reads `missedAt`. */
export function incidentSlaTimerIso(timer: IncidentSlaTimer) {
  return {
    targetMinutes: timer.targetMinutes,
    dueAt: timer.dueAt.toISOString(),
    metAt: timer.metAt?.toISOString() ?? null,
    missedAt: timer.breachDueAt?.toISOString() ?? null,
    missReason: timer.missReason,
    status: timer.status,
  };
}

/** SLA timers of an incident at `now`; null when untracked or canceled. */
export function incidentSlaState(
  incident: IncidentSlaFields,
  now: Date,
): IncidentSlaState | null {
  const snapshot = incident.slaSnapshot;
  if (!snapshot || incident.status === "canceled") return null;
  const targets = snapshot.targets[incident.severity];
  const startsAt = incidentSlaClockStart(incident);
  return {
    response: timer({
      startsAt,
      targetMinutes: targets?.responseMinutes,
      metAt: incident.responseMetAt,
      breachDueAt: incident.responseBreachDueAt,
      missReason: incident.responseMissReason,
      now,
    }),
    resolution: timer({
      startsAt,
      targetMinutes: targets?.resolutionMinutes,
      metAt: incident.resolutionStoppedAt,
      breachDueAt: incident.resolutionBreachDueAt,
      missReason: incident.resolutionMissReason,
      now,
    }),
    resolutionStop: snapshot.resolutionStop,
    responseMet: incidentSlaResponseMet(snapshot),
  };
}

export type IncidentSlaTimerKind = "response" | "resolution";

/**
 * The one timer a compact surface shows: the open timer due next, else a
 * missed one, else the last met.
 */
export function incidentSlaHeadline(
  state: IncidentSlaState,
): { kind: IncidentSlaTimerKind; timer: IncidentSlaTimer } | null {
  const timers = (["response", "resolution"] as const).flatMap((kind) => {
    const timer = state[kind];
    return timer ? [{ kind, timer }] : [];
  });
  const open = timers
    .filter(({ timer }) => timer.metAt === null)
    .sort((a, b) => a.timer.dueAt.getTime() - b.timer.dueAt.getTime());
  return (
    open[0] ??
    timers.find(({ timer }) => timer.status === "breached") ??
    timers[timers.length - 1] ??
    null
  );
}

/**
 * Whether the Acknowledge action is offered: tracked, acknowledgement meets the
 * response, unacknowledged, and still active.
 */
export function incidentAwaitsAcknowledgement(
  incident: IncidentAcknowledgeFields,
): boolean {
  return (
    incident.slaSnapshot !== null &&
    incidentSlaResponseMet(incident.slaSnapshot) === "acknowledged" &&
    incident.acknowledgedAt === null &&
    incident.closedAt === null &&
    (incident.status === "open" || incident.status === "mitigated")
  );
}

/**
 * The stored response fields once the response is met at `at`: set once, and a
 * late meet records the due time it missed in the same write. Empty when nothing changes.
 */
export function incidentResponsePatch(
  incident: IncidentSlaFields,
  at: Date,
): { responseMetAt?: Date; responseBreachDueAt?: Date } {
  if (
    !incident.slaSnapshot ||
    incident.status === "canceled" ||
    incident.responseMetAt
  ) {
    return {};
  }
  const response = incidentSlaState(incident, at)?.response;
  if (
    response &&
    !incident.responseBreachDueAt &&
    at.getTime() > response.dueAt.getTime()
  ) {
    return { responseMetAt: at, responseBreachDueAt: response.dueAt };
  }
  return { responseMetAt: at };
}

/** Whether `status` stops the resolution clock under the snapshot's stop setting. */
export function incidentSlaStopsResolution(
  stop: IncidentSlaSnapshot["resolutionStop"],
  status: IncidentStatus,
): boolean {
  return (
    status === "resolved" || (stop === "mitigated" && status === "mitigated")
  );
}

/**
 * The stored resolution fields for a transition to `to` at `at`: the stop time is
 * set on entering a stop state when empty (a late stop records the missed due
 * time in the same write) and cleared on returning to open.
 */
export function incidentResolutionPatch(
  incident: IncidentSlaFields,
  to: IncidentStatus,
  at: Date,
): { resolutionStoppedAt?: Date | null; resolutionBreachDueAt?: Date } {
  const snapshot = incident.slaSnapshot;
  if (!snapshot || incident.status === "canceled") return {};
  if (to === "open") {
    return incident.resolutionStoppedAt ? { resolutionStoppedAt: null } : {};
  }
  if (
    incident.resolutionStoppedAt ||
    !incidentSlaStopsResolution(snapshot.resolutionStop, to)
  ) {
    return {};
  }
  const resolution = incidentSlaState(incident, at)?.resolution;
  if (
    resolution &&
    !incident.resolutionBreachDueAt &&
    at.getTime() > resolution.dueAt.getTime()
  ) {
    return { resolutionStoppedAt: at, resolutionBreachDueAt: resolution.dueAt };
  }
  return { resolutionStoppedAt: at };
}
