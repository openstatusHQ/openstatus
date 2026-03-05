import type { Workspace } from "@openstatus/db/src/schema/workspaces/validation";
import { createAddStatusReportUpdateTool } from "./add-status-report-update";
import { createCreateMaintenanceTool } from "./create-maintenance";
import { createCreateStatusReportTool } from "./create-status-report";
import { createListMaintenancesTool } from "./list-maintenances";
import { createListStatusPagesTool } from "./list-status-pages";
import { createListStatusReportsTool } from "./list-status-reports";
import { createResolveStatusReportTool } from "./resolve-status-report";
import { createUpdateStatusReportTool } from "./update-status-report";

export function createTools(workspace: Workspace) {
  return {
    listStatusPages: createListStatusPagesTool(workspace.id),
    listStatusReports: createListStatusReportsTool(workspace.id),
    createStatusReport: createCreateStatusReportTool(),
    addStatusReportUpdate: createAddStatusReportUpdateTool(),
    updateStatusReport: createUpdateStatusReportTool(),
    resolveStatusReport: createResolveStatusReportTool(),
    listMaintenances: createListMaintenancesTool(workspace.id),
    createMaintenance: createCreateMaintenanceTool(),
  };
}
