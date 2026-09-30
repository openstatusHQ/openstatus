import type {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServiceContext } from "@openstatus/services";
import {
  addIncidentNoteTool,
  approvePostmortemTool,
  declareIncidentTool,
  getIncidentTool,
  getPostmortemTool,
  listIncidentsTool,
  resolveIncidentTool,
  setIncidentStatusTool,
  updateIncidentTool,
} from "@openstatus/services/agent-tools";

import { registerRegistryTools } from "./registry-adapter";

export function registerIncidentTools(
  server: McpServer,
  ctx: ServiceContext,
): Map<string, RegisteredTool> {
  return registerRegistryTools(server, ctx, [
    listIncidentsTool,
    getIncidentTool,
    declareIncidentTool,
    updateIncidentTool,
    resolveIncidentTool,
    setIncidentStatusTool,
    addIncidentNoteTool,
    getPostmortemTool,
    approvePostmortemTool,
  ]);
}
