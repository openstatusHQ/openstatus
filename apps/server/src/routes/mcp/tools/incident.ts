import type {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServiceContext } from "@openstatus/services";
import {
  acknowledgeIncidentTool,
  createIncidentTool,
  getIncidentTool,
  listIncidentsTool,
  resolveIncidentTool,
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
    createIncidentTool,
    updateIncidentTool,
    acknowledgeIncidentTool,
    resolveIncidentTool,
  ]);
}
