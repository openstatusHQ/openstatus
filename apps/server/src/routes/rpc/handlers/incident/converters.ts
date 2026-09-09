import type { Incident as DbIncident } from "@openstatus/db/src/schema";
import type { Incident as ProtoIncident } from "@openstatus/proto/incident/v1";
import {
  IncidentOrigin,
  IncidentSeverity,
  IncidentStatus,
} from "@openstatus/proto/incident/v1";

type DbStatus = DbIncident["status"];
type DbSeverity = DbIncident["severity"];
type DbOrigin = DbIncident["origin"];

const STATUS_TO_PROTO: Record<DbStatus, IncidentStatus> = {
  triage: IncidentStatus.TRIAGE,
  investigating: IncidentStatus.INVESTIGATING,
  identified: IncidentStatus.IDENTIFIED,
  monitoring: IncidentStatus.MONITORING,
  resolved: IncidentStatus.RESOLVED,
};

const STATUS_TO_DB: Partial<Record<IncidentStatus, DbStatus>> = {
  [IncidentStatus.TRIAGE]: "triage",
  [IncidentStatus.INVESTIGATING]: "investigating",
  [IncidentStatus.IDENTIFIED]: "identified",
  [IncidentStatus.MONITORING]: "monitoring",
  [IncidentStatus.RESOLVED]: "resolved",
};

const SEVERITY_TO_PROTO: Record<DbSeverity, IncidentSeverity> = {
  critical: IncidentSeverity.CRITICAL,
  warning: IncidentSeverity.WARNING,
  info: IncidentSeverity.INFO,
};

const SEVERITY_TO_DB: Partial<Record<IncidentSeverity, DbSeverity>> = {
  [IncidentSeverity.CRITICAL]: "critical",
  [IncidentSeverity.WARNING]: "warning",
  [IncidentSeverity.INFO]: "info",
};

const ORIGIN_TO_PROTO: Record<DbOrigin, IncidentOrigin> = {
  monitor: IncidentOrigin.MONITOR,
  external: IncidentOrigin.EXTERNAL,
  manual: IncidentOrigin.MANUAL,
};

const ORIGIN_TO_DB: Partial<Record<IncidentOrigin, DbOrigin>> = {
  [IncidentOrigin.MONITOR]: "monitor",
  [IncidentOrigin.EXTERNAL]: "external",
  [IncidentOrigin.MANUAL]: "manual",
};

export function protoStatusToDb(status: IncidentStatus): DbStatus | undefined {
  return STATUS_TO_DB[status];
}

export function protoSeverityToDb(
  severity: IncidentSeverity,
): DbSeverity | undefined {
  return SEVERITY_TO_DB[severity];
}

export function protoOriginToDb(origin: IncidentOrigin): DbOrigin | undefined {
  return ORIGIN_TO_DB[origin];
}

export function dbIncidentToProto(incident: DbIncident): ProtoIncident {
  return {
    $typeName: "openstatus.incident.v1.Incident",
    id: String(incident.id),
    title: incident.title,
    summary: incident.summary,
    status: STATUS_TO_PROTO[incident.status],
    severity: SEVERITY_TO_PROTO[incident.severity],
    origin: ORIGIN_TO_PROTO[incident.origin],
    alertSourceId:
      incident.alertSourceId === null
        ? undefined
        : String(incident.alertSourceId),
    statusReportId:
      incident.statusReportId === null
        ? undefined
        : String(incident.statusReportId),
    startedAt: incident.startedAt.toISOString(),
    lastSeenAt: incident.lastSeenAt.toISOString(),
    acknowledgedAt: incident.acknowledgedAt?.toISOString(),
    resolvedAt: incident.resolvedAt?.toISOString(),
    autoResolved: incident.autoResolved,
    createdAt: incident.createdAt?.toISOString() ?? "",
    updatedAt: incident.updatedAt?.toISOString() ?? "",
  };
}
