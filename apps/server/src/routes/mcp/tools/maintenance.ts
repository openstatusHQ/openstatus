import type {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServiceContext } from "@openstatus/services";
import {
  createMaintenanceTool,
  listMaintenancesTool,
} from "@openstatus/services/agent-tools";

import { registerRegistryTools } from "./registry-adapter";

export function registerMaintenanceTools(
  server: McpServer,
  ctx: ServiceContext,
): Map<string, RegisteredTool> {
  return registerRegistryTools(server, ctx, [
    listMaintenancesTool,
    createMaintenanceTool,
  ]);
}
