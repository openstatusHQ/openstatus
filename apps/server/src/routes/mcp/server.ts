import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServiceContext } from "@openstatus/services";

import packageJson from "../../../package.json" with { type: "json" };
import { registerPublicResources } from "./resources";
import { registerAuditTools } from "./tools/audit";
import { registerMaintenanceTools } from "./tools/maintenance";
import { registerMonitorTools } from "./tools/monitor";
import { registerNotificationTools } from "./tools/notification";
import { registerPageTools } from "./tools/page";
import { registerPrivateLocationTools } from "./tools/private-location";
import { registerStatusReportTools } from "./tools/status-report";

/**
 * Build a fresh `McpServer` for this request. Each tool registration
 * closes over `ctx`, so every tool invocation reads the workspace +
 * actor of the request that created the server — workspace scoping is
 * enforced structurally rather than via a per-call lookup. The server
 * and its transport are scoped to a single request and become
 * garbage-collectable once the response stream is consumed.
 *
 * Static tool list (`listChanged: false`); no prompts. Resources are the
 * public documents from `./resources` — they carry no workspace data.
 */
export function createMcpServer(ctx: ServiceContext): McpServer {
  const server = new McpServer(
    { name: "openstatus", version: packageJson.version },
    { capabilities: { tools: { listChanged: false } } },
  );
  registerPublicResources(server);
  registerPageTools(server, ctx);
  registerStatusReportTools(server, ctx);
  registerMaintenanceTools(server, ctx);
  registerMonitorTools(server, ctx);
  registerNotificationTools(server, ctx);
  registerPrivateLocationTools(server, ctx);
  registerAuditTools(server, ctx);
  return server;
}

/**
 * Server for a request that carried no `x-openstatus-key`. MCP clients
 * `initialize` before they have a credential, and an endpoint that refuses the
 * handshake reads as unreachable rather than as protected. No tool is
 * registered, so `tools/list` and `tools/call` are absent — not empty — and
 * nothing workspace-scoped is reachable without a key.
 */
export function createPublicMcpServer(): McpServer {
  const server = new McpServer({
    name: "openstatus",
    version: packageJson.version,
  });
  registerPublicResources(server);
  return server;
}
