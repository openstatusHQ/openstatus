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
