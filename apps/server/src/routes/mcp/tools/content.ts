import type {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServiceContext } from "@openstatus/services";
import {
  getContentPageTool,
  getDocPageTool,
  searchContentTool,
  searchDocsTool,
} from "@openstatus/services/agent-tools";

import { registerRegistryTools } from "./registry-adapter";

/** Public openstatus.dev content — no workspace data, so any credential sees these. */
export function registerContentTools(
  server: McpServer,
  ctx: ServiceContext,
): Map<string, RegisteredTool> {
  return registerRegistryTools(server, ctx, [
    searchDocsTool,
    getDocPageTool,
    searchContentTool,
    getContentPageTool,
  ]);
}
