import type {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServiceContext } from "@openstatus/services";
import type { AnyAgentTool } from "@openstatus/services/agent-tools";
import { ZodObject, type ZodRawShape, type ZodType } from "zod";

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
  const inputShape = assertShape(tool.inputSchema, tool.name, "input");
  const outputShape = assertShape(tool.outputSchema, tool.name, "output");

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
        // Closed-world: every registry tool only touches resources in
        // the caller's workspace (status pages, reports, maintenances) —
        // none reach out to an unbounded set of external entities the
        // way web search or arbitrary URL fetch would.
        openWorldHint: false,
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

// The MCP SDK requires a `ZodRawShape` (flat key→ZodType map), so the
// registry contract is "schemas are ZodObject". A union/intersection at
// the root would silently produce `shape: undefined` and an unusable
// MCP tool — fail loudly at registration instead.
function assertShape(
  schema: ZodType,
  toolName: string,
  kind: "input" | "output",
): ZodRawShape {
  if (!(schema instanceof ZodObject)) {
    throw new Error(
      `MCP tool "${toolName}" has non-ZodObject ${kind} schema; the registry adapter requires a flat ZodObject root.`,
    );
  }
  return schema.shape as ZodRawShape;
}
