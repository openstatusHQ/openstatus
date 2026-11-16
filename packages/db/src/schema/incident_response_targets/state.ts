import type { IncidentSeverity, IncidentStatus } from "../incidents/constants";
import type {
  IncidentTargetResponseMet,
  IncidentTargetSnapshot,
} from "./constants";

export const INCIDENT_TARGET_WARNING_RATIO = 0.75;

const MINUTE = 60_000;

export type IncidentTargetTimerStatus =
  | "running"
  | "at_risk"
  | "met"
  | "breached";

export type IncidentTargetTimer = {
  targetMinutes: number;
  startsAt: Date;
  dueAt: Date;
  warnAt: Date;
  metAt: Date | null;
  /** The due time recorded as missed; once set it never clears. */
  breachDueAt: Date | null;
  status: IncidentTargetTimerStatus;
};

export type IncidentTargetState = {
  response: IncidentTargetTimer | null;
  resolution: IncidentTargetTimer | null;
  resolutionStop: IncidentTargetSnapshot["resolutionStop"];
  responseMet: IncidentTargetResponseMet;
};

export type IncidentTargetFields = {
  status: IncidentStatus;
  severity: IncidentSeverity;
  declaredAt: Date;
  reportedAt?: Date | null;
  targetSnapshot: IncidentTargetSnapshot | null;
  responseMetAt: Date | null;
  responseBreachDueAt: Date | null;
  resolutionStoppedAt: Date | null;
  resolutionBreachDueAt: Date | null;
};

export type IncidentAcknowledgeFields = IncidentTargetFields & {
  acknowledgedAt: Date | null;
  closedAt: Date | null;
};

/** What meets the response on this incident; resolving meets it in every mode. */
export function incidentTargetResponseMet(
  snapshot: IncidentTargetSnapshot | null,
): IncidentTargetResponseMet {
  return snapshot?.responseMet ?? "acknowledged";
}

export function incidentTargetClockStart(
  incident: Pick<IncidentTargetFields, "declaredAt" | "reportedAt">,
): Date {
  return incident.reportedAt ?? incident.declaredAt;
}

function timer(args: {
  startsAt: Date;
  targetMinutes: number | undefined;
  metAt: Date | null;
  breachDueAt: Date | null;
  now: Date;
}): IncidentTargetTimer | null {
  const { startsAt, metAt, breachDueAt, now } = args;
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
    startsAt.getTime() + span * INCIDENT_TARGET_WARNING_RATIO,
  );
  const status: IncidentTargetTimerStatus = breachDueAt
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
    status,
  };
}

/** A timer with ISO times, as the API and agents show it: the recorded miss reads `missedAt`. */
export function incidentTargetTimerIso(timer: IncidentTargetTimer) {
  return {
    targetMinutes: timer.targetMinutes,
    dueAt: timer.dueAt.toISOString(),
    metAt: timer.metAt?.toISOString() ?? null,
    missedAt: timer.breachDueAt?.toISOString() ?? null,
    status: timer.status,
  };
}

/** target timers of an incident at `now`; null when untracked or canceled. */
export function incidentTargetState(
  incident: IncidentTargetFields,
  now: Date,
): IncidentTargetState | null {
  const snapshot = incident.targetSnapshot;
  if (!snapshot || incident.status === "canceled") return null;
  const targets = snapshot.targets[incident.severity];
  const startsAt = incidentTargetClockStart(incident);
  return {
    response: timer({
      startsAt,
      targetMinutes: targets?.responseMinutes,
      metAt: incident.responseMetAt,
      breachDueAt: incident.responseBreachDueAt,
      now,
    }),
    resolution: timer({
      startsAt,
      targetMinutes: targets?.resolutionMinutes,
      metAt: incident.resolutionStoppedAt,
      breachDueAt: incident.resolutionBreachDueAt,
      now,
    }),
    resolutionStop: snapshot.resolutionStop,
    responseMet: incidentTargetResponseMet(snapshot),
  };
}

export type IncidentTargetTimerKind = "response" | "resolution";

/**
 * The one timer a compact surface shows: the open timer due next, else a
 * missed one, else the last met.
 */
export function incidentTargetHeadline(
  state: IncidentTargetState,
): { kind: IncidentTargetTimerKind; timer: IncidentTargetTimer } | null {
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
    incident.targetSnapshot !== null &&
    incidentTargetResponseMet(incident.targetSnapshot) === "acknowledged" &&
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
  incident: IncidentTargetFields,
  at: Date,
): { responseMetAt?: Date; responseBreachDueAt?: Date } {
  if (
    !incident.targetSnapshot ||
    incident.status === "canceled" ||
    incident.responseMetAt
  ) {
    return {};
  }
  const response = incidentTargetState(incident, at)?.response;
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
export function incidentTargetStopsResolution(
  stop: IncidentTargetSnapshot["resolutionStop"],
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
  incident: IncidentTargetFields,
  to: IncidentStatus,
  at: Date,
): { resolutionStoppedAt?: Date | null; resolutionBreachDueAt?: Date } {
  const snapshot = incident.targetSnapshot;
  if (!snapshot || incident.status === "canceled") return {};
  if (to === "open") {
    return incident.resolutionStoppedAt ? { resolutionStoppedAt: null } : {};
  }
  if (
    incident.resolutionStoppedAt ||
    !incidentTargetStopsResolution(snapshot.resolutionStop, to)
  ) {
    return {};
  }
  const resolution = incidentTargetState(incident, at)?.resolution;
  if (
    resolution &&
    !incident.resolutionBreachDueAt &&
    at.getTime() > resolution.dueAt.getTime()
  ) {
    return { resolutionStoppedAt: at, resolutionBreachDueAt: resolution.dueAt };
  }
  return { resolutionStoppedAt: at };
}
