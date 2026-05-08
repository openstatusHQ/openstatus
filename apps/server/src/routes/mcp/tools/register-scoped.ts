import type {
  McpServer,
  RegisteredTool,
  ToolCallback,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Scope } from "@openstatus/db/src/schema";
import type { ServiceContext } from "@openstatus/services";
import { matchesScope } from "@openstatus/services/auth";
import type { ZodRawShape } from "zod";

/**
 * Annotation hints carried through to the SDK. These are first-class
 * MCP-spec metadata that clients use for UX decisions (caching,
 * confirmation prompts, rendering). We mirror the standard fields.
 *
 * `readOnlyHint` is allowed alongside `scope` — they convey related
 * but distinct information (server-side access control vs.
 * client-facing hint), and external MCP clients (Claude Desktop,
 * Cursor) read the annotation, not our scope. The wrapper validates
 * that the two don't disagree (a write tool with `readOnlyHint: true`
 * would lie to clients).
 */
type ToolAnnotations = {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
  title?: string;
};

/**
 * Tool config layered on top of the MCP SDK's `registerTool` shape.
 * The new field is `scope`: a required read/write decision per tool.
 */
type ScopedToolDefinition<
  InputArgs extends ZodRawShape | undefined,
  OutputArgs extends ZodRawShape | undefined,
> = {
  scope: Scope;
  description: string;
  annotations?: ToolAnnotations;
  inputSchema?: InputArgs;
  outputSchema?: OutputArgs;
};

/**
 * Read the actor's scopes for tool gating. Per the plan, non-key
 * actors (today: nothing else hits MCP, but defense-in-depth) get
 * full access — they're already past their own auth boundary.
 */
function actorScopes(ctx: ServiceContext): Scope[] {
  if (ctx.actor.type === "apiKey" || ctx.actor.type === "mcp") {
    return ctx.actor.scopes;
  }
  return ["*"];
}

/**
 * Register an MCP tool only when the calling actor's scopes satisfy
 * `def.scope`. Read-only keys never see write tools in `tools/list`,
 * because skipped tools aren't registered with the server at all.
 *
 * Defense in depth: even if the filter has a bug, the underlying
 * service verb still calls `requireScope(ctx, 'write')` and throws
 * `ForbiddenError`. The filter is UX; the service check is correctness.
 *
 * Returns the `RegisteredTool` when registered, `undefined` when
 * filtered out (so callers can still maintain a `Map<name,
 * RegisteredTool>` for tests / debugging).
 */
export function registerScopedTool<
  // biome-ignore lint/suspicious/noExplicitAny: SDK uses `any` here too
  InputArgs extends ZodRawShape | undefined = any,
  // biome-ignore lint/suspicious/noExplicitAny: SDK uses `any` here too
  OutputArgs extends ZodRawShape | undefined = any,
>(
  server: McpServer,
  ctx: ServiceContext,
  name: string,
  def: ScopedToolDefinition<InputArgs, OutputArgs>,
  handler: ToolCallback<InputArgs extends ZodRawShape ? InputArgs : undefined>,
): RegisteredTool | undefined {
  if (!matchesScope(actorScopes(ctx), def.scope)) {
    return undefined;
  }

  const { scope, annotations, ...rest } = def;

  // Defense: a write tool with `readOnlyHint: true` would lie to MCP
  // clients (Claude Desktop, Cursor) about safe-to-call status. Catch
  // disagreement at registration so it can never ship.
  if (
    annotations?.readOnlyHint !== undefined &&
    annotations.readOnlyHint !== (scope === "read")
  ) {
    throw new Error(
      `MCP tool "${name}": scope="${scope}" disagrees with annotations.readOnlyHint=${annotations.readOnlyHint}`,
    );
  }

  const merged = { ...rest, annotations };
  // TODO(mcp-sdk): drop these casts when @modelcontextprotocol/sdk
  // exports the canonical config + handler types. The generic plumbing
  // around `registerTool` doesn't currently let us thread our narrowed
  // `ScopedToolDefinition` through without a cast at the boundary.
  // biome-ignore lint/suspicious/noExplicitAny: pass-through to SDK
  return server.registerTool(name, merged as any, handler as any);
}
