import type { ServiceContext } from "@openstatus/services";
import type {
  AgentToolRegistry,
  AnyAgentTool,
} from "@openstatus/services/agent-tools";
import { type Tool, tool } from "ai";

/**
 * Convert a registry entry to the AI SDK's `Tool` shape.
 *
 * - **Read tools** carry an `execute` so the SDK runs them server-side
 *   and the model receives the result automatically.
 * - **Destructive tools** intentionally OMIT `execute` when
 *   `destructiveAsHitl: true`. The SDK pauses the stream on the
 *   tool-call part; the client renders a confirm card and POSTs to
 *   `/api/chat/confirm` to actually run the verb. The model resumes
 *   when the client calls `addToolResult`.
 */
export function toAiSdkTools(
  registry: AgentToolRegistry,
  ctx: ServiceContext,
  opts: { destructiveAsHitl: boolean } = { destructiveAsHitl: true },
): Record<string, Tool> {
  const out: Record<string, Tool> = {};
  for (const name in registry) {
    const t = registry[name];
    if (!t) continue;
    out[name] = toolToAiSdkTool(t, ctx, opts);
  }
  return out;
}

function toolToAiSdkTool(
  t: AnyAgentTool,
  ctx: ServiceContext,
  opts: { destructiveAsHitl: boolean },
): Tool {
  const skipExecute = opts.destructiveAsHitl && t.destructive;
  if (skipExecute) {
    return tool({
      description: t.description,
      inputSchema: t.inputSchema,
    });
  }
  return tool({
    description: t.description,
    inputSchema: t.inputSchema,
    execute: async (input: unknown) => {
      return t.run({ ctx, input: t.inputSchema.parse(input) });
    },
  });
}
