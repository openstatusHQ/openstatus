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
] as const;

export type IncidentSeverity = (typeof incidentSeverity)[number];
export type IncidentStatus = (typeof incidentStatus)[number];
export type IncidentEventType = (typeof incidentEventType)[number];
