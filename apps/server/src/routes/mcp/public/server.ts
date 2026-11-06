import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  type AgentTool,
  getServiceStatusTool,
  listActiveIssuesTool,
  runGetServiceStatus,
  runListActiveIssues,
} from "@openstatus/services/agent-tools";
import { ZodObject, type ZodRawShape } from "zod";

import packageJson from "../../../../package.json" with { type: "json" };
import { runTool } from "../adapter";

const INSTRUCTIONS = `Live status of 3,000+ third-party services (cloud, AI, SaaS, developer tools), read from their official status pages every few minutes and combined with user reports on openstatus.dev.

When a request to a third-party provider fails or slows down, call get_service_status before changing code; pass component to narrow to one part of the service. Lead with its verdict and link the service url. A calm status page does not prove the provider is fine: status pages often lag the start of a problem.

Call list_active_issues to see what is broken across providers, or pass services to check the providers a project depends on.

No login is needed. To manage your own monitors, status pages and incidents, connect the signed-in openstatus MCP server at https://api.openstatus.dev/mcp.`;

function shape(schema: unknown, name: string): ZodRawShape {
  if (!(schema instanceof ZodObject)) {
    throw new Error(`public MCP tool "${name}" needs a flat ZodObject schema`);
  }
  return schema.shape as ZodRawShape;
}

function registerPublicTool<I, O>(
  server: McpServer,
  tool: AgentTool<I, O>,
  run: (input: I) => Promise<O>,
) {
  server.registerTool(
    tool.name,
    {
      description: tool.description,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      inputSchema: shape(tool.inputSchema, tool.name),
      outputSchema: shape(tool.outputSchema, tool.name),
    },
    async (input: unknown): Promise<CallToolResult> =>
      runTool(
        () => run(tool.inputSchema.parse(input)),
        (value) => {
          const out = tool.outputSchema.parse(value);
          return {
            content: [{ type: "text", text: JSON.stringify(out) }],
            structuredContent: out as Record<string, unknown>,
          };
        },
      ),
  );
}

/**
 * The anonymous `/mcp/status` server: only the read-only status tools, no
 * workspace and no credential, so it carries none of the write rules.
 */
export function createPublicStatusMcpServer(): McpServer {
  const server = new McpServer(
    { name: "openstatus-status", version: packageJson.version },
    {
      capabilities: { tools: { listChanged: false } },
      instructions: INSTRUCTIONS,
    },
  );
  registerPublicTool(server, getServiceStatusTool, runGetServiceStatus);
  registerPublicTool(server, listActiveIssuesTool, runListActiveIssues);
  return server;
}
