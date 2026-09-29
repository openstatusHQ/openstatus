import type {
  IncidentSeverity,
  IncidentStatus,
} from "@openstatus/db/src/schema/incidents/constants";

export const severityConfig = {
  critical: {
    label: "Critical",
    className: "text-destructive border-destructive/40",
  },
  major: { label: "Major", className: "text-warning border-warning/40" },
  minor: { label: "Minor", className: "text-info border-info/40" },
} as const satisfies Record<
  IncidentSeverity,
  { label: string; className: string }
>;

export const statusConfig = {
  open: { label: "Open", className: "text-destructive" },
  mitigated: { label: "Mitigated", className: "text-warning" },
  resolved: { label: "Resolved", className: "text-success" },
  canceled: { label: "Canceled", className: "text-muted-foreground" },
} as const satisfies Record<
  IncidentStatus,
  { label: string; className: string }
>;

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
