import {
  type IncidentSeverity,
  incidentSeverity,
} from "../incidents/constants";

export const incidentTargetResolutionStops = ["mitigated", "resolved"] as const;
export type IncidentTargetResolutionStop =
  (typeof incidentTargetResolutionStops)[number];

export const incidentTargetResponseMets = [
  "acknowledged",
  "status_report",
] as const;
export type IncidentTargetResponseMet =
  (typeof incidentTargetResponseMets)[number];

export const incidentTargetTargetKinds = [
  "responseMinutes",
  "resolutionMinutes",
] as const;
export type IncidentTargetTargetKind =
  (typeof incidentTargetTargetKinds)[number];

/** A missing kind turns that timer off; a missing severity has no timers. */
export type IncidentTargetSeverityTargets = Partial<
  Record<IncidentTargetTargetKind, number>
>;
export type IncidentTargetTargets = Partial<
  Record<IncidentSeverity, IncidentTargetSeverityTargets>
>;

/** The policy as fixed on an incident at declare; later policy edits never touch it. */
export type IncidentTargetSnapshot = {
  targets: IncidentTargetTargets;
  resolutionStop: IncidentTargetResolutionStop;
  /** Absent on snapshots taken before the choice existed: acknowledgement. */
  responseMet?: IncidentTargetResponseMet;
};

export const INCIDENT_TARGET_TARGET_MIN_MINUTES = 5;
export const INCIDENT_TARGET_TARGET_MAX_MINUTES = 30 * 24 * 60;

export const defaultIncidentTargetTargets = {
  critical: { responseMinutes: 60, resolutionMinutes: 240 },
  major: { responseMinutes: 240, resolutionMinutes: 1440 },
  minor: { responseMinutes: 1440, resolutionMinutes: 4320 },
} as const satisfies Required<IncidentTargetTargets>;

const kindLabel: Record<IncidentTargetTargetKind, string> = {
  responseMinutes: "response",
  resolutionMinutes: "resolution",
};

/** Why the targets cannot be saved, naming the field, or null. Shared by the verb and the form. */
export function incidentTargetTargetsError(
  targets: IncidentTargetTargets,
): string | null {
  let any = false;
  for (const severity of incidentSeverity) {
    const t = targets[severity];
    if (!t) continue;
    const label = severity.charAt(0).toUpperCase() + severity.slice(1);
    for (const kind of incidentTargetTargetKinds) {
      const value = t[kind];
      if (value === undefined) continue;
      any = true;
      if (
        !Number.isInteger(value) ||
        value < INCIDENT_TARGET_TARGET_MIN_MINUTES ||
        value > INCIDENT_TARGET_TARGET_MAX_MINUTES
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
