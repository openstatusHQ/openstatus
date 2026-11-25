export const incidentSeverity = ["critical", "major", "minor"] as const;

export const incidentStatus = [
  "open",
  "mitigated",
  "resolved",
  "canceled",
] as const;

export const incidentEventType = [
  "declared",
  "severity_changed",
  "status_changed",
  "commander_changed",
  "started_at_changed",
  "note",
  "status_report_linked",
  "status_report_unlinked",
  "slack_channel_bound",
  "slack_channel_unbound",
  "mitigated",
  "resolved",
  "canceled",
  "postmortem_drafted",
  "postmortem_updated",
  "postmortem_approved",
  "closed",
  "acknowledged",
] as const;

// `source_ref` by source: slack → message permalink (null for slash commands
// and modals); api / mcp → API key id; agent → run or thread id, if any;
// dashboard / system → null.
export const incidentEventSource = [
  "dashboard",
  "api",
  "mcp",
  "slack",
  "agent",
  "system",
] as const;

export type IncidentSeverity = (typeof incidentSeverity)[number];
export type IncidentStatus = (typeof incidentStatus)[number];
export type IncidentEventType = (typeof incidentEventType)[number];
export type IncidentEventSource = (typeof incidentEventSource)[number];

/** Acknowledge is offered once, while the incident is still being worked on. */
export function incidentAwaitsAcknowledgement(incident: {
  status: IncidentStatus;
  closedAt: Date | null;
  acknowledgedAt: Date | null;
}): boolean {
  return (
    incident.acknowledgedAt === null &&
    incident.closedAt === null &&
    (incident.status === "open" || incident.status === "mitigated")
  );
}

export const postmortemStatus = ["draft", "approved"] as const;
export const postmortemAuthor = ["agent", "user"] as const;

export type PostmortemStatus = (typeof postmortemStatus)[number];
export type PostmortemAuthor = (typeof postmortemAuthor)[number];
