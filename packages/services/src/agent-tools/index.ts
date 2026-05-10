import type { z } from "zod";

import { createMaintenanceTool, listMaintenancesTool } from "./maintenance";
import { listStatusPagesTool } from "./page";
import {
  addStatusReportUpdateTool,
  createStatusReportTool,
  listStatusReportsTool,
  resolveStatusReportTool,
  updateStatusReportTool,
} from "./status-report";
import type { AnyAgentTool } from "./types";

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
 *
 * `satisfies` (not a typed assignment) keeps the literal-keyed object
 * type intact, so `keyof typeof agentTools` is the union of tool names
 * and `(typeof agentTools)[N]["inputSchema"]` carries through to the
 * concrete schema for that specific tool. Consumers (dashboard
 * renderers) can then `z.infer` per tool name without any casts.
 */
export const agentTools = {
  list_status_pages: listStatusPagesTool,
  list_status_reports: listStatusReportsTool,
  create_status_report: createStatusReportTool,
  add_status_report_update: addStatusReportUpdateTool,
  update_status_report: updateStatusReportTool,
  resolve_status_report: resolveStatusReportTool,
  list_maintenances: listMaintenancesTool,
  create_maintenance: createMaintenanceTool,
} satisfies Record<string, AnyAgentTool>;

/**
 * Iteration view used by adapters that don't care about the literal
 * key (MCP `registerRegistryTools`, AI SDK `toAiSdkTools`). Equivalent
 * to `Object.values(agentTools)`; the explicit array preserves the
 * v1 order.
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
