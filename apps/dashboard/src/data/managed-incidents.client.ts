import type {
  IncidentSeverity,
  IncidentStatus,
} from "@openstatus/db/src/schema/incidents/constants";

import type { StatusVariant } from "@/components/common/status-dot";

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
  return { start: incident.startedAt, end: incidentEndedAt(incident) };
}

/** Calendar mark by severity; a canceled incident fades to grey. */
export function incidentActivity(incident: {
  status: IncidentStatus;
  severity: IncidentSeverity;
}) {
  if (incident.status === "canceled") {
    return { variant: "default", level: 1 } as const;
  }
  return {
    variant: severityConfig[incident.severity].variant,
    level: severityLevels[incident.severity],
  };
}
