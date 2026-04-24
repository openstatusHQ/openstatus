import type {
  Maintenance,
  MaintenanceSummary,
} from "@openstatus/proto/maintenance/v1";

type DBMaintenance = {
  id: number;
  title: string;
  message: string;
  from: Date;
  to: Date;
  workspaceId: number | null;
  pageId: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

/**
 * Convert a DB maintenance to proto summary format.
 */
export function dbMaintenanceToProtoSummary(
  maintenance: DBMaintenance,
  pageComponentIds: string[],
): MaintenanceSummary {
  return {
    $typeName: "openstatus.maintenance.v1.MaintenanceSummary" as const,
    id: String(maintenance.id),
    title: maintenance.title,
    message: maintenance.message,
    from: maintenance.from.toISOString(),
    to: maintenance.to.toISOString(),
    pageId: maintenance.pageId ? String(maintenance.pageId) : "",
    pageComponentIds,
    createdAt: maintenance.createdAt?.toISOString() ?? "",
    updatedAt: maintenance.updatedAt?.toISOString() ?? "",
  };
}

/**
 * Convert a DB maintenance to full proto format.
 */
export function dbMaintenanceToProto(
  maintenance: DBMaintenance,
  pageComponentIds: string[],
): Maintenance {
  return {
    $typeName: "openstatus.maintenance.v1.Maintenance" as const,
    id: String(maintenance.id),
    title: maintenance.title,
    message: maintenance.message,
    from: maintenance.from.toISOString(),
    to: maintenance.to.toISOString(),
    pageId: maintenance.pageId ? String(maintenance.pageId) : "",
    pageComponentIds,
    createdAt: maintenance.createdAt?.toISOString() ?? "",
    updatedAt: maintenance.updatedAt?.toISOString() ?? "",
  };
}
