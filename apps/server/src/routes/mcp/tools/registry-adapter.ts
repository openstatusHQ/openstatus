import type {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServiceContext } from "@openstatus/services";
import type { AnyAgentTool } from "@openstatus/services/agent-tools";
import type { ZodObject, ZodRawShape } from "zod";

import { runTool } from "../adapter";
import { registerScopedTool } from "./register-scoped";

/**
 * Map a single registry tool into the MCP server. Handles:
 *   - converting the registry's flat ZodObject input/output schemas into
 *     the SDK's `ZodRawShape` (it expects a `.shape` map, not the object)
 *   - mirroring the tool's `destructive` flag onto the MCP `annotations`
 *     so external clients (Claude Desktop, Cursor) get the standard
 *     readOnly/destructive hints
 *   - wrapping `tool.run` through `runTool` so service errors map to
 *     either recoverable `CallToolResult.isError` or thrown `McpError`s.
 */
export function registerRegistryTool(
  server: McpServer,
  ctx: ServiceContext,
  tool: AnyAgentTool,
): RegisteredTool | undefined {
  const inputShape = (tool.inputSchema as unknown as ZodObject<ZodRawShape>)
    .shape;
  const outputShape = (tool.outputSchema as unknown as ZodObject<ZodRawShape>)
    .shape;

  return registerScopedTool(
    server,
    ctx,
    tool.name,
    {
      scope: tool.scope,
      description: tool.description,
      annotations: {
        readOnlyHint: tool.scope === "read",
        destructiveHint: tool.destructive,
        idempotentHint: !tool.destructive,
        openWorldHint: tool.destructive,
      },
      inputSchema: inputShape,
      outputSchema: outputShape,
    },
    async (input: unknown) =>
      runTool(
        () => tool.run({ ctx, input: tool.inputSchema.parse(input) }),
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
 * Register every tool whose name appears in `names`. Returns the
 * `RegisteredTool` map (keyed by tool name) so callers can keep their
 * existing shape for tests / debugging.
 */
export function registerRegistryTools(
  server: McpServer,
  ctx: ServiceContext,
  tools: AnyAgentTool[],
): Map<string, RegisteredTool> {
  const registered = new Map<string, RegisteredTool>();
  for (const tool of tools) {
    const handle = registerRegistryTool(server, ctx, tool);
    if (handle) registered.set(tool.name, handle);
  }
  return registered;
}
