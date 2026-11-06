import type {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServiceContext } from "@openstatus/services";
import {
  getServiceStatusTool,
  listActiveIssuesTool,
} from "@openstatus/services/agent-tools";

import { registerRegistryTools } from "./registry-adapter";

/** Status of third-party services from openstatus.dev/status — no workspace data. */
export function registerExternalStatusTools(
  server: McpServer,
  ctx: ServiceContext,
): Map<string, RegisteredTool> {
  return registerRegistryTools(server, ctx, [
    getServiceStatusTool,
    listActiveIssuesTool,
  ]);
}
