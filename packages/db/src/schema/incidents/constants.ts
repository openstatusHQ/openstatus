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
  "sla_response_breached",
  "sla_resolution_breached",
  "sla_update_missed",
  "reported_at_changed",
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

export const postmortemStatus = ["draft", "approved"] as const;
export const postmortemAuthor = ["agent", "user"] as const;

export type PostmortemStatus = (typeof postmortemStatus)[number];
export type PostmortemAuthor = (typeof postmortemAuthor)[number];

export const INCIDENT_REPORTED_AT_MAX_BEFORE_MS = 30 * 24 * 60 * 60 * 1000;
export const INCIDENT_REPORTED_AT_ERROR =
  "Reported at must be between 30 days before the declare and the declare itself";

/** A report time is allowed from 30 days before the declare up to the declare. */
export function isAllowedIncidentReportedAt(
  reportedAt: Date,
  declaredAt: Date,
): boolean {
  const ms = reportedAt.getTime();
  return (
    Number.isFinite(ms) &&
    ms <= declaredAt.getTime() &&
    ms >= declaredAt.getTime() - INCIDENT_REPORTED_AT_MAX_BEFORE_MS
  );
}
