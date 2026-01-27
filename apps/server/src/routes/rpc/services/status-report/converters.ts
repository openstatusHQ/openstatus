import type {
  StatusReport,
  StatusReportSummary,
  StatusReportUpdate,
} from "@openstatus/proto/status_report/v1";
import { StatusReportStatus } from "@openstatus/proto/status_report/v1";

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
    default:
      return "investigating";
  }
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
