import {
  type IncidentSeverity,
  incidentSeverity,
} from "../incidents/constants";

export const incidentSlaResolutionStops = ["mitigated", "resolved"] as const;
export type IncidentSlaResolutionStop =
  (typeof incidentSlaResolutionStops)[number];

export const incidentSlaResponseMets = [
  "acknowledged",
  "status_report",
] as const;
export type IncidentSlaResponseMet = (typeof incidentSlaResponseMets)[number];

export const incidentSlaTargetKinds = [
  "responseMinutes",
  "resolutionMinutes",
  "updateMinutes",
] as const;
export type IncidentSlaTargetKind = (typeof incidentSlaTargetKinds)[number];

/** A missing kind turns that timer off; a missing severity has no timers. */
export type IncidentSlaSeverityTargets = Partial<
  Record<IncidentSlaTargetKind, number>
>;
export type IncidentSlaTargets = Partial<
  Record<IncidentSeverity, IncidentSlaSeverityTargets>
>;

/** The policy as fixed on an incident at declare; later policy edits never touch it. */
export type IncidentSlaSnapshot = {
  targets: IncidentSlaTargets;
  resolutionStop: IncidentSlaResolutionStop;
  /** Absent on snapshots taken before the choice existed: acknowledgement. */
  responseMet?: IncidentSlaResponseMet;
};

export const INCIDENT_SLA_TARGET_MIN_MINUTES = 5;
export const INCIDENT_SLA_TARGET_MAX_MINUTES = 30 * 24 * 60;

export const defaultIncidentSlaTargets = {
  critical: { responseMinutes: 60, resolutionMinutes: 240, updateMinutes: 120 },
  major: { responseMinutes: 240, resolutionMinutes: 1440, updateMinutes: 240 },
  minor: {
    responseMinutes: 1440,
    resolutionMinutes: 4320,
    updateMinutes: 720,
  },
} as const satisfies Required<IncidentSlaTargets>;

const kindLabel: Record<IncidentSlaTargetKind, string> = {
  responseMinutes: "response",
  resolutionMinutes: "resolution",
  updateMinutes: "update",
};

/** Why the targets cannot be saved, naming the field, or null. Shared by the verb and the form. */
export function incidentSlaTargetsError(
  targets: IncidentSlaTargets,
): string | null {
  let any = false;
  for (const severity of incidentSeverity) {
    const t = targets[severity];
    if (!t) continue;
    const label = severity.charAt(0).toUpperCase() + severity.slice(1);
    for (const kind of incidentSlaTargetKinds) {
      const value = t[kind];
      if (value === undefined) continue;
      any = true;
      if (
        !Number.isInteger(value) ||
        value < INCIDENT_SLA_TARGET_MIN_MINUTES ||
        value > INCIDENT_SLA_TARGET_MAX_MINUTES
      ) {
        return `${label}: the ${kindLabel[kind]} target must be between 5m and 30d.`;
      }
    }
    if (
      t.responseMinutes !== undefined &&
      t.resolutionMinutes !== undefined &&
      t.responseMinutes > t.resolutionMinutes
    ) {
      return `${label}: the response target cannot be longer than the resolution target.`;
    }
  }
  return any ? null : "Set at least one target.";
}
