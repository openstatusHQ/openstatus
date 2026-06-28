import type {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServiceContext } from "@openstatus/services";
import {
  getAuditLogTool,
  listAuditLogsTool,
} from "@openstatus/services/agent-tools";

import { registerRegistryTools } from "./registry-adapter";

/** Skip registration when the plan lacks `audit-log` so the tools don't surface in `tools/list`. */
export function registerAuditTools(
  server: McpServer,
  ctx: ServiceContext,
): Map<string, RegisteredTool> {
  if (!ctx.workspace.limits["audit-log"]) {
    return new Map();
  }
  return registerRegistryTools(server, ctx, [
    listAuditLogsTool,
    getAuditLogTool,
  ]);
}
