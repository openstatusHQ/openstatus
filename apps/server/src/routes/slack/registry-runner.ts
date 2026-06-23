import type { ServiceContext } from "@openstatus/services";
import {
  type AgentToolName,
  type AnyAgentTool,
  agentTools,
} from "@openstatus/services/agent-tools";
import { type Tool, tool } from "ai";
import { ZodObject, type ZodType, type z } from "zod";

/**
 * Marker shape returned by destructive tool wrappers. The agent handler
 * detects it and posts a Block Kit confirmation card; the user's button
 * click then drives `executeRegistryAction` (see interactions.ts).
 *
 * `input` is the raw model input — it is persisted and re-runs through the
 * tool at approval time, so carry-forward enrichment recomputes from fresh
 * state then. `displayInput` is an enriched snapshot used only to render the
 * confirmation card; freezing it into `input` would publish stale impacts if
 * state changed between draft and approval.
 */
export type SlackToolDraft = {
  needsConfirmation: true;
  toolName: string;
  input: unknown;
  displayInput: unknown;
};

export function isSlackToolDraft(value: unknown): value is SlackToolDraft {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.needsConfirmation === true && typeof v.toolName === "string";
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

export function buildTool(t: AnyAgentTool, ctx: ServiceContext): Tool {
  // HITL is gated on `destructive`, not on scope: a non-destructive
  // write (none today, but conceivable — e.g. an idempotent reconcile)
  // should run inline like reads do.
  if (!t.destructive) {
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
      const displayInput = t.approval?.prepareDraftInput
        ? await t.approval.prepareDraftInput({ ctx, input: parsed })
        : parsed;
      const draft: SlackToolDraft = {
        needsConfirmation: true,
        toolName: t.name,
        input: parsed,
        displayInput,
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
 * Throws if `inputSchema` isn't a ZodObject — `.omit` only exists there,
 * and a union/intersection at the root would otherwise produce a
 * confusing runtime error several frames deep.
 */
export function deriveDraftSchema(t: AnyAgentTool): ZodType {
  const flagIds = t.approval?.extraFlags?.map((f) => f.id) ?? [];
  if (flagIds.length === 0) return t.inputSchema;
  if (!(t.inputSchema instanceof ZodObject)) {
    throw new Error(
      `slack registry: tool "${t.name}" declares extraFlags but inputSchema is not a ZodObject; .omit() is unavailable.`,
    );
  }
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
