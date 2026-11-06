import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServiceContext } from "@openstatus/services";
import { buildMcpServerInstructions } from "@openstatus/services/agent-tools";

import packageJson from "../../../package.json" with { type: "json" };
import { registerPublicResources } from "./resources";
import { registerAuditTools } from "./tools/audit";
import { registerContentTools } from "./tools/content";
import { registerExternalStatusTools } from "./tools/external-status";
import { registerIncidentTools } from "./tools/incident";
import { registerMaintenanceTools } from "./tools/maintenance";
import { registerMonitorTools } from "./tools/monitor";
import { registerNotificationTools } from "./tools/notification";
import { registerPageTools } from "./tools/page";
import { registerPrivateLocationTools } from "./tools/private-location";
import { registerStatusReportTools } from "./tools/status-report";
import { registerWorkspaceTools } from "./tools/workspace";

/**
 * Build a fresh `McpServer` for this request. Each tool registration
 * closes over `ctx`, so every tool invocation reads the workspace +
 * actor of the request that created the server — workspace scoping is
 * enforced structurally rather than via a per-call lookup. The server
 * and its transport are scoped to a single request and become
 * garbage-collectable once the response stream is consumed.
 *
 * Static tool list (`listChanged: false`); no prompts. `instructions`
 * carry the write-confirmation rules, since clients may not prompt. Resources are the
 * public documents from `./resources` — they carry no workspace data.
 */
export function createMcpServer(ctx: ServiceContext): McpServer {
  const server = new McpServer(
    { name: "openstatus", version: packageJson.version },
    {
      capabilities: { tools: { listChanged: false } },
      instructions: buildMcpServerInstructions({
        canNotifySubscribers:
          ctx.workspace.limits["status-subscribers"] === true,
      }),
    },
  );
  registerPublicResources(server);
  registerPageTools(server, ctx);
  registerStatusReportTools(server, ctx);
  registerIncidentTools(server, ctx);
  registerMaintenanceTools(server, ctx);
  registerMonitorTools(server, ctx);
  registerNotificationTools(server, ctx);
  registerPrivateLocationTools(server, ctx);
  registerWorkspaceTools(server, ctx);
  registerAuditTools(server, ctx);
  registerContentTools(server, ctx);
  registerExternalStatusTools(server, ctx);
  return server;
}
