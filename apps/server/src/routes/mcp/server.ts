import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServiceContext } from "@openstatus/services";

import packageJson from "../../../package.json" with { type: "json" };
import { registerMaintenanceTools } from "./tools/maintenance";
import { registerPageTools } from "./tools/page";
import { registerStatusReportTools } from "./tools/status-report";

/**
 * Build a fresh `McpServer` for this request and register all 8 tools
 * with closures over the per-request `ServiceContext` (workspace
 * scoping is structural — see `mcp-plan.md` §"Per-request lifecycle").
 *
 * Static tool list — `listChanged: false`. No prompts/resources.
 */
export function createMcpServer(ctx: ServiceContext): McpServer {
  const server = new McpServer(
    { name: "openstatus", version: packageJson.version },
    { capabilities: { tools: { listChanged: false } } },
  );
  registerPageTools(server, ctx);
  registerStatusReportTools(server, ctx);
  registerMaintenanceTools(server, ctx);
  return server;
}
