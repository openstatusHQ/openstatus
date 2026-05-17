import type { ServiceContext } from "@openstatus/services";
import {
  type AgentToolName,
  type AnyAgentTool,
  agentTools,
} from "@openstatus/services/agent-tools";
import { type Tool, tool } from "ai";
import type { ZodObject, ZodType, z } from "zod";

/**
 * Marker shape returned by destructive tool wrappers. The agent handler
 * detects it and posts a Block Kit confirmation card; the user's button
 * click then drives `executeRegistryAction` (see interactions.ts).
 */
export type SlackToolDraft = {
  needsConfirmation: true;
  toolName: string;
  input: unknown;
};

export function isSlackToolDraft(value: unknown): value is SlackToolDraft {
  return (
    typeof value === "object" &&
    value !== null &&
    "needsConfirmation" in value &&
    (value as { needsConfirmation: unknown }).needsConfirmation === true &&
    "toolName" in value
  );
}

/**
 * Build the AI SDK tools dictionary backed by the registry. Read tools
 * execute server-side immediately; destructive tools return a draft for
 * the user to approve. The LLM-facing schema for HITL tools omits the
 * extraFlag fields (e.g. `notify`) so the model can't be expected to
 * answer them — the user supplies them via the Block Kit buttons.
 */
export function buildSlackTools(ctx: ServiceContext): Record<string, Tool> {
  const out: Record<string, Tool> = {};
  for (const name of Object.keys(agentTools) as AgentToolName[]) {
    out[name] = buildTool(agentTools[name] as AnyAgentTool, ctx);
  }
  return out;
}

function buildTool(t: AnyAgentTool, ctx: ServiceContext): Tool {
  if (t.scope === "read") {
    return tool({
      description: t.description,
      inputSchema: t.inputSchema,
      execute: async (input: unknown) => {
        const parsed = t.inputSchema.parse(input);
        return t.run({ ctx, input: parsed });
      },
    });
  }

  // Destructive: hide extraFlag fields from the LLM so it can't omit them
  // and so it can't pre-decide a value the user owns. The full schema
  // re-validates after applyFlags on button click.
  const draftSchema = deriveDraftSchema(t);
  return tool({
    description: t.description,
    inputSchema: draftSchema,
    execute: async (input: unknown) => {
      const parsed = draftSchema.parse(input);
      const draft: SlackToolDraft = {
        needsConfirmation: true,
        toolName: t.name,
        input: parsed,
      };
      return draft;
    },
  });
}

/**
 * Return a schema that omits every extraFlag field declared on the tool's
 * approval metadata. Used only for the Slack LLM-facing schema; the
 * registry's strict schema is the source of truth at execute time.
 *
 * Safe because `agentTools` rejects non-ZodObject schemas (see MCP
 * registry-adapter's `assertShape`) — every registered tool's input is a
 * ZodObject and supports `.omit`.
 */
function deriveDraftSchema(t: AnyAgentTool): ZodType {
  const flagIds = t.approval?.extraFlags?.map((f) => f.id) ?? [];
  if (flagIds.length === 0) return t.inputSchema;
  const obj = t.inputSchema as unknown as ZodObject<z.ZodRawShape>;
  const mask: Record<string, true> = {};
  for (const id of flagIds) mask[id] = true;
  return obj.omit(mask) as unknown as ZodType;
}

/**
 * Look up a registry tool by name. Used by the Slack interaction handler
 * when resuming a pending action from the carrier.
 */
export function getRegistryTool(name: string): AnyAgentTool | undefined {
  return (agentTools as Record<string, AnyAgentTool>)[name];
}

/**
 * Drive a pending action through the registry: apply user-supplied flags,
 * parse against the strict registry schema, execute. Returns the parsed
 * input + raw output so the presenter can render. Throws whatever
 * `tool.run` throws — the caller maps it.
 */
export async function executeRegistryAction(args: {
  tool: AnyAgentTool;
  ctx: ServiceContext;
  draftInput: unknown;
  flags: Record<string, boolean>;
}): Promise<{ input: unknown; output: unknown }> {
  const { tool: t, ctx, draftInput, flags } = args;
  const finalInput = t.approval?.applyFlags
    ? t.approval.applyFlags(draftInput, flags)
    : draftInput;
  // Parse against the strict registry schema — this is the boundary
  // that gates `notify` (and any other extraFlag-injected fields).
  const parsed = t.inputSchema.parse(finalInput);
  const output = await t.run({ ctx, input: parsed });
  return { input: parsed, output };
}
