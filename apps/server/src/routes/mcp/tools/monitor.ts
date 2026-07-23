import type {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServiceContext } from "@openstatus/services";
import {
  getMonitorStatusTool,
  getMonitorSummaryTool,
  getMonitorTool,
  getResponseLogTool,
  listMonitorsTool,
  listResponseLogsTool,
} from "@openstatus/services/agent-tools";

import { registerRegistryTools } from "./registry-adapter";

export function registerMonitorTools(
  server: McpServer,
  ctx: ServiceContext,
): Map<string, RegisteredTool> {
  return registerRegistryTools(server, ctx, [
    listMonitorsTool,
    getMonitorTool,
    getMonitorStatusTool,
    getMonitorSummaryTool,
    listResponseLogsTool,
    getResponseLogTool,
  ]);
}
