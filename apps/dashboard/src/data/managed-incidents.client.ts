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
  open: { label: "Open", variant: "destructive" },
  mitigated: { label: "Mitigated", variant: "warning" },
  resolved: { label: "Resolved", variant: "success" },
  canceled: { label: "Canceled", variant: "default" },
} as const satisfies Record<
  IncidentStatus,
  { label: string; variant: StatusVariant }
>;

export function formatIncidentId(id: number): string {
  return `INC-${String(id).padStart(3, "0")}`;
}

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

export function personName(
  person: {
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  } | null,
): string | null {
  if (!person) return null;
  const full = [person.firstName, person.lastName].filter(Boolean).join(" ");
  return person.name || full || person.email || null;
}
