import type {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServiceContext } from "@openstatus/services";
import {
  getPlaybookTool,
  listPlaybooksTool,
  updatePlaybookTool,
} from "@openstatus/services/agent-tools";

import { registerRegistryTools } from "./registry-adapter";

export function registerPlaybookTools(
  server: McpServer,
  ctx: ServiceContext,
): Map<string, RegisteredTool> {
  return registerRegistryTools(server, ctx, [
    listPlaybooksTool,
    getPlaybookTool,
    updatePlaybookTool,
  ]);
}
