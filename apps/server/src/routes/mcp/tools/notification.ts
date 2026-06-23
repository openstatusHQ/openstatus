import type {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp";
import type { ServiceContext } from "@openstatus/services";
import { listNotificationsTool } from "@openstatus/services/agent-tools";

import { registerRegistryTools } from "./registry-adapter";

export function registerNotificationTools(
  server: McpServer,
  ctx: ServiceContext,
): Map<string, RegisteredTool> {
  return registerRegistryTools(server, ctx, [listNotificationsTool]);
}
