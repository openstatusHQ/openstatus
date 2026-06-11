import type {
  ComponentImpact,
  StatusReport,
  StatusReportSummary,
  StatusReportUpdate,
} from "@openstatus/proto/status_report/v1";
import {
  PageComponentImpact,
  StatusReportStatus,
} from "@openstatus/proto/status_report/v1";
import { Code, ConnectError } from "@connectrpc/connect";

import { invalidStatusError } from "./errors";

type DBPageComponentImpact =
  | "operational"
  | "degraded_performance"
  | "partial_outage"
  | "major_outage";

type DBComponentImpact = {
  pageComponentId: number;
  impact: DBPageComponentImpact;
};

type DBStatusReport = {
  id: number;
  status: "investigating" | "identified" | "monitoring" | "resolved";
  title: string;
  workspaceId: number | null;
  pageId: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

type DBStatusReportUpdate = {
  id: number;
  status: "investigating" | "identified" | "monitoring" | "resolved";
  date: Date;
  message: string;
  statusReportId: number;
  createdAt: Date | null;
  updatedAt: Date | null;
  componentImpacts?: DBComponentImpact[];
};

/**
 * Convert DB status string to proto enum.
 */
export function dbStatusToProto(
  status: "investigating" | "identified" | "monitoring" | "resolved",
): StatusReportStatus {
  switch (status) {
    case "investigating":
      return StatusReportStatus.INVESTIGATING;
    case "identified":
      return StatusReportStatus.IDENTIFIED;
    case "monitoring":
      return StatusReportStatus.MONITORING;
    case "resolved":
      return StatusReportStatus.RESOLVED;
    default:
      return StatusReportStatus.UNSPECIFIED;
  }
}

/**
 * Convert proto enum to DB status string.
 */
export function protoStatusToDb(
  status: StatusReportStatus,
): "investigating" | "identified" | "monitoring" | "resolved" {
  switch (status) {
    case StatusReportStatus.INVESTIGATING:
      return "investigating";
    case StatusReportStatus.IDENTIFIED:
      return "identified";
    case StatusReportStatus.MONITORING:
      return "monitoring";
    case StatusReportStatus.RESOLVED:
      return "resolved";
    case StatusReportStatus.UNSPECIFIED:
      throw invalidStatusError(status);
    default:
      throw invalidStatusError(status);
  }
}

/**
 * Convert DB impact string to proto enum.
 */
export function dbImpactToProto(
  impact: DBPageComponentImpact,
): PageComponentImpact {
  switch (impact) {
    case "operational":
      return PageComponentImpact.OPERATIONAL;
    case "degraded_performance":
      return PageComponentImpact.DEGRADED_PERFORMANCE;
    case "partial_outage":
      return PageComponentImpact.PARTIAL_OUTAGE;
    case "major_outage":
      return PageComponentImpact.MAJOR_OUTAGE;
    default:
      return PageComponentImpact.UNSPECIFIED;
  }
}

/**
 * Convert proto enum to DB impact string. UNSPECIFIED is a caller error here —
 * "doesn't speak impact" is expressed by omitting the entry, never by sending
 * an unspecified one (it must not silently become operational).
 */
export function protoImpactToDb(
  impact: PageComponentImpact,
): DBPageComponentImpact {
  switch (impact) {
    case PageComponentImpact.OPERATIONAL:
      return "operational";
    case PageComponentImpact.DEGRADED_PERFORMANCE:
      return "degraded_performance";
    case PageComponentImpact.PARTIAL_OUTAGE:
      return "partial_outage";
    case PageComponentImpact.MAJOR_OUTAGE:
      return "major_outage";
    default:
      throw new ConnectError(
        `Invalid component impact: ${impact}`,
        Code.InvalidArgument,
      );
  }
}

function dbComponentImpactToProto(impact: DBComponentImpact): ComponentImpact {
  return {
    $typeName: "openstatus.status_report.v1.ComponentImpact" as const,
    pageComponentId: String(impact.pageComponentId),
    impact: dbImpactToProto(impact.impact),
  };
}

/**
 * Convert a DB status report update to proto format.
 */
export function dbUpdateToProto(
  update: DBStatusReportUpdate,
): StatusReportUpdate {
  return {
    $typeName: "openstatus.status_report.v1.StatusReportUpdate" as const,
    id: String(update.id),
    status: dbStatusToProto(update.status),
    date: update.date.toISOString(),
    message: update.message,
    createdAt: update.createdAt?.toISOString() ?? "",
    componentImpacts: (update.componentImpacts ?? []).map(
      dbComponentImpactToProto,
    ),
  };
}

/**
 * Convert a DB status report to proto summary format (metadata only).
 */
export function dbReportToProtoSummary(
  report: DBStatusReport,
  pageComponentIds: string[],
): StatusReportSummary {
  return {
    $typeName: "openstatus.status_report.v1.StatusReportSummary" as const,
    id: String(report.id),
    status: dbStatusToProto(report.status),
    title: report.title,
    pageComponentIds,
    createdAt: report.createdAt?.toISOString() ?? "",
    updatedAt: report.updatedAt?.toISOString() ?? "",
  };
}

/**
 * Convert a DB status report to full proto format (with updates).
 */
export function dbReportToProto(
  report: DBStatusReport,
  pageComponentIds: string[],
  updates: DBStatusReportUpdate[],
): StatusReport {
  return {
    $typeName: "openstatus.status_report.v1.StatusReport" as const,
    id: String(report.id),
    status: dbStatusToProto(report.status),
    title: report.title,
    pageComponentIds,
    updates: updates.map(dbUpdateToProto),
    createdAt: report.createdAt?.toISOString() ?? "",
    updatedAt: report.updatedAt?.toISOString() ?? "",
  };
}
