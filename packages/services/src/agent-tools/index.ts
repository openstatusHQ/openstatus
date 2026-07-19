import type { z } from "zod";

import { getAuditLogTool, listAuditLogsTool } from "./audit";
import { getDocPageTool, searchDocsTool } from "./docs";
import { createMaintenanceTool, listMaintenancesTool } from "./maintenance";
import {
  getMonitorStatusTool,
  getMonitorSummaryTool,
  getMonitorTool,
  getResponseLogTool,
  listMonitorsTool,
  listResponseLogsTool,
} from "./monitor";
import { listNotificationsTool } from "./notification";
import { listStatusPagesTool } from "./page";
import { listPageComponentsTool } from "./page-component";
import {
  addStatusReportUpdateTool,
  createStatusReportTool,
  listStatusReportsTool,
  resolveStatusReportTool,
  updateStatusReportTool,
} from "./status-report";
import type { AnyAgentTool } from "./types";

export { getAuditLogTool, listAuditLogsTool } from "./audit";
export { getDocPageTool, searchDocsTool } from "./docs";
export { createMaintenanceTool, listMaintenancesTool } from "./maintenance";
export {
  getMonitorStatusTool,
  getMonitorSummaryTool,
  getMonitorTool,
  getResponseLogTool,
  listMonitorsTool,
  listResponseLogsTool,
} from "./monitor";
export { listNotificationsTool } from "./notification";
export { listStatusPagesTool } from "./page";
export { listPageComponentsTool } from "./page-component";
export {
  addStatusReportUpdateTool,
  createStatusReportTool,
  listStatusReportsTool,
  resolveStatusReportTool,
  updateStatusReportTool,
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
  list_page_components: listPageComponentsTool,
  list_status_reports: listStatusReportsTool,
  create_status_report: createStatusReportTool,
  add_status_report_update: addStatusReportUpdateTool,
  update_status_report: updateStatusReportTool,
  resolve_status_report: resolveStatusReportTool,
  list_maintenances: listMaintenancesTool,
  create_maintenance: createMaintenanceTool,
  list_monitors: listMonitorsTool,
  get_monitor: getMonitorTool,
  get_monitor_status: getMonitorStatusTool,
  get_monitor_summary: getMonitorSummaryTool,
  list_response_logs: listResponseLogsTool,
  get_response_log: getResponseLogTool,
  list_notifications: listNotificationsTool,
  list_audit_logs: listAuditLogsTool,
  get_audit_log: getAuditLogTool,
  search_docs: searchDocsTool,
  get_doc_page: getDocPageTool,
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
