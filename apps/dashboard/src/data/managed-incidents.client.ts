import type {
  IncidentSeverity,
  IncidentStatus,
} from "@openstatus/db/src/schema/incidents/constants";

import type { StatusVariant } from "@/components/common/status-dot";
import type { ActivityMark } from "@/components/content/activity";

export const severityConfig = {
  critical: { label: "Critical", variant: "destructive" },
  major: { label: "Major", variant: "warning" },
  minor: { label: "Minor", variant: "info" },
} as const satisfies Record<
  IncidentSeverity,
  { label: string; variant: StatusVariant }
>;

export const statusConfig = {
  open: { label: "Open", color: "text-destructive/80", variant: "destructive" },
  mitigated: {
    label: "Mitigated",
    color: "text-warning/80",
    variant: "warning",
  },
  resolved: {
    label: "Resolved",
    color: "text-success/80",
    variant: "success",
  },
  canceled: {
    label: "Canceled",
    color: "text-muted-foreground",
    variant: "default",
  },
} as const satisfies Record<
  IncidentStatus,
  { label: string; color: string; variant: StatusVariant }
>;

/** When the incident stopped being ongoing; `null` while it still is. */
export function incidentEndedAt(incident: {
  status: IncidentStatus;
  resolvedAt: Date | null;
  closedAt: Date | null;
}): Date | null {
  if (incident.status === "resolved" && incident.resolvedAt) {
    return incident.resolvedAt;
  }
  return incident.closedAt;
}

export const severityLevels = {
  minor: 1,
  major: 2,
  critical: 3,
} as const satisfies Record<IncidentSeverity, 1 | 2 | 3>;

export function incidentSpan(incident: {
  status: IncidentStatus;
  startedAt: Date;
  resolvedAt: Date | null;
  closedAt: Date | null;
}) {
  // canceled never really happened: mark the start day, not the weeks until someone canceled it
  if (incident.status === "canceled") {
    return { start: incident.startedAt, end: incident.startedAt };
  }
  return { start: incident.startedAt, end: incidentEndedAt(incident) };
}

/** Calendar mark by severity; a canceled incident is hatched. */
export function incidentActivity(incident: {
  status: IncidentStatus;
  severity: IncidentSeverity;
}): ActivityMark & { label: string } {
  if (incident.status === "canceled") {
    return { scale: "failure", level: 0, hatched: true, label: "Canceled" };
  }
  return {
    scale: "failure",
    level: severityLevels[incident.severity],
    label: severityConfig[incident.severity].label,
  };
}

type ResponseTimeFields = {
  status: IncidentStatus;
  declaredAt: Date;
  acknowledgedAt: Date | null;
  mitigatedAt: Date | null;
  resolvedAt: Date | null;
};

type ResponseStep = "acknowledge" | "mitigate" | "resolve";

const since = (from: Date, to: Date | null) =>
  to ? to.getTime() - from.getTime() : null;

/** Milliseconds from the declare to each step; `null` when unknown. */
export function incidentResponseTimes(
  incident: ResponseTimeFields,
): Record<ResponseStep, number | null> {
  return {
    acknowledge: since(incident.declaredAt, incident.acknowledgedAt),
    mitigate: since(incident.declaredAt, incident.mitigatedAt),
    // a reopened incident keeps its old resolvedAt
    resolve:
      incident.status === "resolved"
        ? since(incident.declaredAt, incident.resolvedAt)
        : null,
  };
}

/** Per-step averages over incidents declared in `now`'s month, canceled ones left out. */
export function monthlyResponseAverages(
  incidents: ResponseTimeFields[],
  now = new Date(),
): Record<ResponseStep, { average: number | null; count: number }> {
  const times = incidents
    .filter(
      (i) =>
        i.status !== "canceled" &&
        i.declaredAt.getFullYear() === now.getFullYear() &&
        i.declaredAt.getMonth() === now.getMonth(),
    )
    .map(incidentResponseTimes);
  const average = (step: ResponseStep) => {
    const values = times
      .map((t) => t[step])
      .filter((v): v is number => v !== null);
    return {
      average: values.length
        ? values.reduce((sum, v) => sum + v, 0) / values.length
        : null,
      count: values.length,
    };
  };
  return {
    acknowledge: average("acknowledge"),
    mitigate: average("mitigate"),
    resolve: average("resolve"),
  };
}
