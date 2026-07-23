import type {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServiceContext } from "@openstatus/services";
import { listPrivateLocationsTool } from "@openstatus/services/agent-tools";

import { registerRegistryTools } from "./registry-adapter";

export function registerPrivateLocationTools(
  server: McpServer,
  ctx: ServiceContext,
): Map<string, RegisteredTool> {
  return registerRegistryTools(server, ctx, [listPrivateLocationsTool]);
}
