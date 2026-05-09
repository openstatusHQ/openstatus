import { createMaintenanceTool, listMaintenancesTool } from "./maintenance";
import { listStatusPagesTool } from "./page";
import {
  addStatusReportUpdateTool,
  createStatusReportTool,
  listStatusReportsTool,
  resolveStatusReportTool,
  updateStatusReportTool,
} from "./status-report";
import type { AgentToolRegistry, AnyAgentTool } from "./types";

export {
  createMaintenanceTool,
  listMaintenancesTool,
} from "./maintenance";
export { listStatusPagesTool } from "./page";
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
  InferAgentToolInput,
  InferAgentToolOutput,
} from "./types";
export {
  type AgentSystemPromptOptions,
  buildAgentSystemPrompt,
} from "./prompt";

/**
 * Aggregate registry — order matches the v1 MCP parity surface in the plan.
 * Adding a tool here surfaces it on every adapter (MCP + dashboard chat).
 */
export const agentToolList: AnyAgentTool[] = [
  listStatusPagesTool,
  listStatusReportsTool,
  createStatusReportTool,
  addStatusReportUpdateTool,
  updateStatusReportTool,
  resolveStatusReportTool,
  listMaintenancesTool,
  createMaintenanceTool,
];

export const agentTools: AgentToolRegistry = Object.fromEntries(
  agentToolList.map((tool) => [tool.name, tool]),
);
