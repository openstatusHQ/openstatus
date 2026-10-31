import type { z } from "zod";

import { isFeatureEnabled } from "../features";
import type { Workspace } from "../types";
import { getAuditLogTool, listAuditLogsTool } from "./audit";
import { getContentPageTool, searchContentTool } from "./content";
import { getDocPageTool, searchDocsTool } from "./docs";
import {
  addIncidentNoteTool,
  approvePostmortemTool,
  declareIncidentTool,
  draftPostmortemTool,
  getIncidentTool,
  getPostmortemTool,
  listIncidentsTool,
  resolveIncidentTool,
  setIncidentStatusTool,
  updateIncidentTool,
} from "./incident";
import {
  addMaintenanceUpdateTool,
  createMaintenanceTool,
  deleteMaintenanceUpdateTool,
  getMaintenanceTool,
  listMaintenancesTool,
  updateMaintenanceTool,
  updateMaintenanceUpdateTool,
} from "./maintenance";
import {
  createMonitorTool,
  getMonitorStatusTool,
  getMonitorSummaryTool,
  getMonitorTool,
  getResponseLogTool,
  listMonitorsTool,
  listResponseLogsTool,
  updateMonitorTool,
} from "./monitor";
import { listNotificationsTool } from "./notification";
import {
  createStatusPageTool,
  listStatusPagesTool,
  updateStatusPageTool,
} from "./page";
import {
  addPageComponentTool,
  listPageComponentsTool,
  updatePageComponentTool,
} from "./page-component";
import {
  createComponentGroupTool,
  updateComponentGroupTool,
} from "./page-component-group";
import { listPrivateLocationsTool } from "./private-location";
import {
  addStatusReportUpdateTool,
  createStatusReportTool,
  deleteStatusReportUpdateTool,
  getStatusReportTool,
  listStatusReportsTool,
  resolveStatusReportTool,
  updateStatusReportTool,
  updateStatusReportUpdateTool,
} from "./status-report";
import type { AnyAgentTool } from "./types";
import { getWorkspaceTool } from "./workspace";

export { getAuditLogTool, listAuditLogsTool } from "./audit";
export { getContentPageTool, searchContentTool } from "./content";
export { getDocPageTool, searchDocsTool } from "./docs";
export {
  addIncidentNoteTool,
  approvePostmortemTool,
  declareIncidentTool,
  draftPostmortemTool,
  getIncidentTool,
  getPostmortemTool,
  listIncidentsTool,
  resolveIncidentTool,
  setIncidentStatusTool,
  updateIncidentTool,
} from "./incident";
export {
  addMaintenanceUpdateTool,
  createMaintenanceTool,
  deleteMaintenanceUpdateTool,
  getMaintenanceTool,
  listMaintenancesTool,
  updateMaintenanceTool,
  updateMaintenanceUpdateTool,
} from "./maintenance";
export {
  createMonitorTool,
  getMonitorStatusTool,
  getMonitorSummaryTool,
  getMonitorTool,
  getResponseLogTool,
  listMonitorsTool,
  listResponseLogsTool,
  updateMonitorTool,
} from "./monitor";
export { listNotificationsTool } from "./notification";
export {
  createStatusPageTool,
  listStatusPagesTool,
  updateStatusPageTool,
} from "./page";
export {
  addPageComponentTool,
  listPageComponentsTool,
  updatePageComponentTool,
} from "./page-component";
export {
  createComponentGroupTool,
  updateComponentGroupTool,
} from "./page-component-group";
export { listPrivateLocationsTool } from "./private-location";
export { getWorkspaceTool } from "./workspace";
export {
  addStatusReportUpdateTool,
  createStatusReportTool,
  deleteStatusReportUpdateTool,
  getStatusReportTool,
  listStatusReportsTool,
  resolveStatusReportTool,
  updateStatusReportTool,
  updateStatusReportUpdateTool,
} from "./status-report";
export type {
  AgentTool,
  AgentToolRegistry,
  AnyAgentTool,
  ApprovalMeta,
  ExtraFlag,
  InferAgentToolInput,
  InferAgentToolOutput,
  SummaryLine,
  SummaryLineRef,
} from "./types";
export {
  type AgentSystemPromptOptions,
  buildAgentSystemPrompt,
} from "./prompt";

/**
 * Aggregate registry. Adding a tool here surfaces it on every adapter
 * (MCP + dashboard chat).
 *
 * `satisfies` (not a typed assignment) keeps the literal-keyed object
 * type intact, so `keyof typeof agentTools` is the union of tool names
 * and `(typeof agentTools)[N]["inputSchema"]` carries through to the
 * concrete schema for that specific tool. Consumers can then `z.infer`
 * per tool name without any casts.
 */
export const agentTools = {
  list_status_pages: listStatusPagesTool,
  create_status_page: createStatusPageTool,
  update_status_page: updateStatusPageTool,
  list_page_components: listPageComponentsTool,
  add_page_component: addPageComponentTool,
  update_page_component: updatePageComponentTool,
  create_component_group: createComponentGroupTool,
  update_component_group: updateComponentGroupTool,
  list_status_reports: listStatusReportsTool,
  get_status_report: getStatusReportTool,
  create_status_report: createStatusReportTool,
  add_status_report_update: addStatusReportUpdateTool,
  update_status_report: updateStatusReportTool,
  resolve_status_report: resolveStatusReportTool,
  update_status_report_update: updateStatusReportUpdateTool,
  delete_status_report_update: deleteStatusReportUpdateTool,
  list_incidents: listIncidentsTool,
  get_incident: getIncidentTool,
  declare_incident: declareIncidentTool,
  update_incident: updateIncidentTool,
  resolve_incident: resolveIncidentTool,
  set_incident_status: setIncidentStatusTool,
  add_incident_note: addIncidentNoteTool,
  get_postmortem: getPostmortemTool,
  draft_postmortem: draftPostmortemTool,
  approve_postmortem: approvePostmortemTool,
  list_maintenances: listMaintenancesTool,
  get_maintenance: getMaintenanceTool,
  create_maintenance: createMaintenanceTool,
  update_maintenance: updateMaintenanceTool,
  add_maintenance_update: addMaintenanceUpdateTool,
  update_maintenance_update: updateMaintenanceUpdateTool,
  delete_maintenance_update: deleteMaintenanceUpdateTool,
  list_monitors: listMonitorsTool,
  create_monitor: createMonitorTool,
  update_monitor: updateMonitorTool,
  get_monitor: getMonitorTool,
  get_monitor_status: getMonitorStatusTool,
  get_monitor_summary: getMonitorSummaryTool,
  list_response_logs: listResponseLogsTool,
  get_response_log: getResponseLogTool,
  list_notifications: listNotificationsTool,
  list_private_locations: listPrivateLocationsTool,
  get_workspace: getWorkspaceTool,
  list_audit_logs: listAuditLogsTool,
  get_audit_log: getAuditLogTool,
  search_docs: searchDocsTool,
  get_doc_page: getDocPageTool,
  search_content: searchContentTool,
  get_content_page: getContentPageTool,
} satisfies Record<string, AnyAgentTool>;

// Multi-flag confirmation UX should be a modal, not 2^N buttons. Fail
// loudly at module load if anything sneaks in past the tuple type.
for (const tool of Object.values(agentTools) as AnyAgentTool[]) {
  const flags = tool.approval?.extraFlags;
  if (flags && flags.length > 1) {
    throw new Error(
      `agent-tools: "${tool.name}" declares ${flags.length} extraFlags; cap is 1.`,
    );
  }
  if (flags?.length && !tool.approval?.applyFlags) {
    throw new Error(
      `agent-tools: "${tool.name}" declares extraFlags but no applyFlags.`,
    );
  }
}

/** Whether a tool is offered in this workspace (feature-gated tools are hidden). */
export function isAgentToolAvailable(
  tool: AnyAgentTool,
  workspace: Pick<Workspace, "id">,
): boolean {
  return !tool.feature || isFeatureEnabled(workspace, tool.feature);
}

/**
 * Iteration view used by adapters that don't care about the literal key.
 * Equivalent to `Object.values(agentTools)`.
 */
export const agentToolList: AnyAgentTool[] = Object.values(agentTools);

/** Literal union of every registered tool's name. */
export type AgentToolName = keyof typeof agentTools;

/** Concrete input type for a given tool name. */
export type AgentToolInput<N extends AgentToolName> = z.infer<
  (typeof agentTools)[N]["inputSchema"]
>;

/** Concrete output type for a given tool name. */
export type AgentToolOutput<N extends AgentToolName> = z.infer<
  (typeof agentTools)[N]["outputSchema"]
>;
