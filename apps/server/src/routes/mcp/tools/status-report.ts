import type {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServiceContext } from "@openstatus/services";
import {
  addStatusReportUpdateTool,
  createStatusReportTool,
  listStatusReportsTool,
  resolveStatusReportTool,
  updateStatusReportTool,
} from "@openstatus/services/agent-tools";

import { registerRegistryTools } from "./registry-adapter";

export function registerStatusReportTools(
  server: McpServer,
  ctx: ServiceContext,
): Map<string, RegisteredTool> {
  return registerRegistryTools(server, ctx, [
    listStatusReportsTool,
    createStatusReportTool,
    addStatusReportUpdateTool,
    updateStatusReportTool,
    resolveStatusReportTool,
  ]);
}
