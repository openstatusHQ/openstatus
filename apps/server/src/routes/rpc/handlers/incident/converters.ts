import { incidentSlaTimerIso } from "@openstatus/db/src/schema/incident_sla_policies/state";
import type {
  Incident,
  IncidentEvent,
  IncidentSla,
  IncidentSlaTimer,
  IncidentStatusReport,
  IncidentSummary,
  IncidentUser,
  Postmortem,
} from "@openstatus/proto/incident/v1";
import {
  IncidentEventType,
  IncidentSeverity,
  IncidentSlaTimerStatus,
  IncidentStatus,
  PostmortemAuthor,
  PostmortemStatus,
} from "@openstatus/proto/incident/v1";
import type {
  getIncidentOrThrow,
  getPostmortem,
  listIncidentEvents,
  listIncidents,
} from "@openstatus/services/incident";
import { toAttributedUserDetail } from "@openstatus/services/incident";

import { dbStatusToProto as dbReportStatusToProto } from "../status-report/converters";
import { invalidEnumError } from "./errors";

type IncidentView = Awaited<ReturnType<typeof getIncidentOrThrow>>;
type IncidentListItem = Awaited<
  ReturnType<typeof listIncidents>
>["items"][number];
type IncidentEventRow = Awaited<ReturnType<typeof listIncidentEvents>>[number];
type PostmortemRow = NonNullable<Awaited<ReturnType<typeof getPostmortem>>>;

type DbSeverity = IncidentView["severity"];
type DbStatus = IncidentView["status"];
type DbEventType = IncidentEventRow["type"];
type IncidentSlaState = IncidentView["sla"];
type DbSlaTimer = NonNullable<NonNullable<IncidentSlaState>["response"]>;

type UserRow = {
  id: number;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  deletedAt: Date | null;
};

type IncidentFields = {
  id: number;
  title: string;
  severity: DbSeverity;
  status: DbStatus;
  declaredAt: Date;
  startedAt: Date;
  reportedAt: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  acknowledgedAt: Date | null;
  commander: UserRow | null;
  acknowledgedByUser: UserRow | null;
  sla: IncidentSlaState;
};

export function protoSeverityToDb(severity: IncidentSeverity): DbSeverity {
  switch (severity) {
    case IncidentSeverity.CRITICAL:
      return "critical";
    case IncidentSeverity.MAJOR:
      return "major";
    case IncidentSeverity.MINOR:
      return "minor";
    default:
      throw invalidEnumError("severity");
  }
}

export function dbSeverityToProto(severity: DbSeverity): IncidentSeverity {
  switch (severity) {
    case "critical":
      return IncidentSeverity.CRITICAL;
    case "major":
      return IncidentSeverity.MAJOR;
    case "minor":
      return IncidentSeverity.MINOR;
  }
}

export function protoStatusToDb(status: IncidentStatus): DbStatus {
  switch (status) {
    case IncidentStatus.OPEN:
      return "open";
    case IncidentStatus.MITIGATED:
      return "mitigated";
    case IncidentStatus.RESOLVED:
      return "resolved";
    case IncidentStatus.CANCELED:
      return "canceled";
    default:
      throw invalidEnumError("status");
  }
}

export function dbStatusToProto(status: DbStatus): IncidentStatus {
  switch (status) {
    case "open":
      return IncidentStatus.OPEN;
    case "mitigated":
      return IncidentStatus.MITIGATED;
    case "resolved":
      return IncidentStatus.RESOLVED;
    case "canceled":
      return IncidentStatus.CANCELED;
  }
}

export function dbEventTypeToProto(type: DbEventType): IncidentEventType {
  switch (type) {
    case "declared":
      return IncidentEventType.DECLARED;
    case "severity_changed":
      return IncidentEventType.SEVERITY_CHANGED;
    // `mitigated` is in the enum but never written: mitigation is a status change.
    case "status_changed":
    case "mitigated":
      return IncidentEventType.STATUS_CHANGED;
    case "commander_changed":
      return IncidentEventType.COMMANDER_CHANGED;
    case "started_at_changed":
      return IncidentEventType.STARTED_AT_CHANGED;
    case "note":
      return IncidentEventType.NOTE;
    case "status_report_linked":
      return IncidentEventType.STATUS_REPORT_LINKED;
    case "status_report_unlinked":
      return IncidentEventType.STATUS_REPORT_UNLINKED;
    case "slack_channel_bound":
      return IncidentEventType.SLACK_CHANNEL_BOUND;
    case "slack_channel_unbound":
      return IncidentEventType.SLACK_CHANNEL_UNBOUND;
    case "resolved":
      return IncidentEventType.RESOLVED;
    case "canceled":
      return IncidentEventType.CANCELED;
    case "postmortem_drafted":
      return IncidentEventType.POSTMORTEM_DRAFTED;
    case "postmortem_updated":
      return IncidentEventType.POSTMORTEM_UPDATED;
    case "postmortem_approved":
      return IncidentEventType.POSTMORTEM_APPROVED;
    case "closed":
      return IncidentEventType.CLOSED;
    case "acknowledged":
      return IncidentEventType.ACKNOWLEDGED;
    case "sla_response_breached":
      return IncidentEventType.SLA_RESPONSE_BREACHED;
    case "sla_resolution_breached":
      return IncidentEventType.SLA_RESOLUTION_BREACHED;
    case "sla_update_missed":
      return IncidentEventType.SLA_UPDATE_MISSED;
    case "reported_at_changed":
      return IncidentEventType.REPORTED_AT_CHANGED;
    case "sla_response_miss_explained":
      return IncidentEventType.SLA_RESPONSE_MISS_EXPLAINED;
    case "sla_resolution_miss_explained":
      return IncidentEventType.SLA_RESOLUTION_MISS_EXPLAINED;
  }
}

export function toIncidentUser(
  row: UserRow | null | undefined,
): IncidentUser | undefined {
  const user = toAttributedUserDetail(row);
  if (!user) return undefined;
  return {
    $typeName: "openstatus.incident.v1.IncidentUser",
    email: user.email ?? "",
    name: user.name,
  };
}

export function toSlackChannelUrl(
  teamId: string | null,
  channelId: string | null,
): string | undefined {
  if (!teamId || !channelId) return undefined;
  const params = new URLSearchParams({ team: teamId, channel: channelId });
  return `https://slack.com/app_redirect?${params.toString()}`;
}

function toStatusReport(
  report:
    | {
        id: number;
        title: string;
        status: Parameters<typeof dbReportStatusToProto>[0];
        pageId?: number | null;
      }
    | null
    | undefined,
): IncidentStatusReport | undefined {
  if (!report) return undefined;
  return {
    $typeName: "openstatus.incident.v1.IncidentStatusReport",
    id: String(report.id),
    title: report.title,
    status: dbReportStatusToProto(report.status),
    pageId: report.pageId == null ? "" : String(report.pageId),
  };
}

function iso(date: Date | null | undefined): string | undefined {
  return date ? date.toISOString() : undefined;
}

function dbSlaStatusToProto(
  status: DbSlaTimer["status"],
): IncidentSlaTimerStatus {
  switch (status) {
    case "running":
      return IncidentSlaTimerStatus.RUNNING;
    case "at_risk":
      return IncidentSlaTimerStatus.AT_RISK;
    case "met":
      return IncidentSlaTimerStatus.MET;
    case "breached":
      return IncidentSlaTimerStatus.BREACHED;
  }
}

function toSlaTimer(timer: DbSlaTimer | null): IncidentSlaTimer | undefined {
  if (!timer) return undefined;
  const t = incidentSlaTimerIso(timer);
  return {
    $typeName: "openstatus.incident.v1.IncidentSlaTimer",
    targetMinutes: t.targetMinutes,
    dueAt: t.dueAt,
    metAt: t.metAt ?? undefined,
    missedAt: t.missedAt ?? undefined,
    status: dbSlaStatusToProto(t.status),
    missReason: t.missReason ?? undefined,
  };
}

export function incidentSlaToProto(
  state: IncidentSlaState,
): IncidentSla | undefined {
  if (!state) return undefined;
  return {
    $typeName: "openstatus.incident.v1.IncidentSla",
    response: toSlaTimer(state.response),
    resolution: toSlaTimer(state.resolution),
  };
}

function summaryFields(row: IncidentFields) {
  return {
    id: String(row.id),
    title: row.title,
    severity: dbSeverityToProto(row.severity),
    status: dbStatusToProto(row.status),
    commander: toIncidentUser(row.commander),
    declaredAt: row.declaredAt.toISOString(),
    startedAt: row.startedAt.toISOString(),
    reportedAt: iso(row.reportedAt),
    resolvedAt: iso(row.resolvedAt),
    closedAt: iso(row.closedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    acknowledgedAt: iso(row.acknowledgedAt),
    acknowledgedBy: toIncidentUser(row.acknowledgedByUser),
    sla: incidentSlaToProto(row.sla),
  };
}

export function incidentSummaryToProto(row: IncidentListItem): IncidentSummary {
  return {
    $typeName: "openstatus.incident.v1.IncidentSummary",
    ...summaryFields(row),
    statusReport: toStatusReport(row.statusReport),
  };
}

export function incidentEventToProto(
  event: Pick<IncidentEventRow, "id" | "type" | "message" | "createdAt"> & {
    createdByUser: UserRow | null;
  },
): IncidentEvent {
  return {
    $typeName: "openstatus.incident.v1.IncidentEvent",
    id: String(event.id),
    type: dbEventTypeToProto(event.type),
    message: event.message ?? "",
    createdBy: toIncidentUser(event.createdByUser),
    createdAt: event.createdAt.toISOString(),
  };
}

export function incidentToProto(
  view: IncidentView,
  events: IncidentEventRow[] = [],
): Incident {
  return {
    $typeName: "openstatus.incident.v1.Incident",
    ...summaryFields(view),
    summary: view.summary ?? undefined,
    declaredBy: toIncidentUser(view.declaredByUser),
    resolvedBy: toIncidentUser(view.resolvedByUser),
    mitigatedAt: iso(view.mitigatedAt),
    statusReport: toStatusReport(view.statusReport),
    slackChannelUrl: toSlackChannelUrl(view.slackTeamId, view.slackChannelId),
    allowedTransitions: view.allowedTransitions.map(dbStatusToProto),
    deletable: view.deletable,
    events: events.map(incidentEventToProto),
  };
}

export function postmortemToProto(row: PostmortemRow): Postmortem {
  return {
    $typeName: "openstatus.incident.v1.Postmortem",
    incidentId: String(row.incidentId),
    status:
      row.status === "approved"
        ? PostmortemStatus.APPROVED
        : PostmortemStatus.DRAFT,
    content: row.content,
    draftedBy:
      row.draftedBy === "agent"
        ? PostmortemAuthor.AGENT
        : PostmortemAuthor.USER,
    approvedBy: toIncidentUser(row.approvedByUser),
    approvedAt: iso(row.approvedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
