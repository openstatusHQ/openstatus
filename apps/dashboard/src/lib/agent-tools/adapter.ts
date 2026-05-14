import type { ServiceContext } from "@openstatus/services";
import type {
  AgentToolRegistry,
  AnyAgentTool,
} from "@openstatus/services/agent-tools";
import { type Tool, tool } from "ai";

/**
 * Convert a registry entry to the AI SDK's `Tool` shape.
 *
 * Read tools execute server-side as soon as the model emits them.
 *
 * Destructive tools opt into the SDK's *approval flow* via
 * `needsApproval: true`. The SDK pauses with `state: "approval-requested"`
 * before the tool executes; the client renders a confirm card and
 * resolves via `addToolApprovalResponse({ id, approved, reason })`. On
 * approve the SDK runs `execute` itself on the next stream; on deny
 * the part transitions to `output-denied` (a first-class cancel state)
 * and `execute` is never invoked. This replaces the older "omit
 * `execute` + custom `/api/chat/confirm`" pattern, which forced us to
 * reinvent cancel semantics in user-land.
 */
export function toAiSdkTools(
  registry: AgentToolRegistry,
  ctx: ServiceContext,
): Record<string, Tool> {
  const out: Record<string, Tool> = {};
  for (const name in registry) {
    const t = registry[name];
    if (!t) continue;
    out[name] = toolToAiSdkTool(t, ctx);
  }
  return out;
}

function toolToAiSdkTool(t: AnyAgentTool, ctx: ServiceContext): Tool {
  return tool({
    description: t.description,
    inputSchema: t.inputSchema,
    needsApproval: t.destructive,
    execute: async (input: unknown) => {
      return t.run({ ctx, input: t.inputSchema.parse(input) });
    },
  });
}
