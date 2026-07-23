import type { Scope } from "@openstatus/db/src/schema";
import type { ZodType, z } from "zod";

import type { ServiceContext } from "../context";

/**
 * Framework-agnostic tool descriptor shared by every adapter (MCP, AI SDK, Slack).
 * `description` is factual; behavioral rubrics live in the system prompt
 * so per-surface prompts can vary the wording. `destructive` is mirrored
 * onto MCP `destructiveHint` and used by the AI SDK adapter to enable
 * HITL approval. `run` returns plain JS objects — the MCP adapter wraps
 * them into `CallToolResult`.
 */
export type AgentTool<TInput = unknown, TOutput = unknown> = {
  name: string;
  description: string;
  scope: Scope;
  destructive: boolean;
  inputSchema: ZodType<TInput>;
  outputSchema: ZodType<TOutput>;
  run(args: { ctx: ServiceContext; input: TInput }): Promise<TOutput>;

  /**
   * Optional HITL metadata consumed by surfaces that orchestrate approval
   * outside `run()` (today: Slack). MCP relies on `destructiveHint`; the
   * AI SDK uses `needsApproval: t.destructive`. When set, the surface
   * adapter stores the partial input, then re-injects the user's flag
   * choice via `applyFlags` before calling `run`.
   */
  approval?: ApprovalMeta<TInput>;
};

export type ExtraFlag = {
  /**
   * Schema field name injected back into input by `applyFlags`.
   *
   * Convention: when `id === "notify"`, the tool's `outputSchema` SHOULD
   * include `notified: boolean` reporting the actual dispatch outcome
   * (notify failures are typically swallowed, so the input flag and the
   * realized outcome can differ). Surfaces use that field to render
   * "subscribers notified" honestly.
   */
  id: string;
  /** Human-readable button label. */
  label: string;
  /** Default value when the user picks the non-flagged option. Defaults to false. */
  default?: boolean;
};

/**
 * Structured reference a rendering surface can resolve into entity names
 * (e.g. a dashboard link, or component names in place of ids), replacing the
 * raw `value`. Kept as a descriptor — resolution needs DB access, which the
 * edge-safe services layer must not do.
 */
export type SummaryLineRef =
  | { kind: "page"; pageId: number }
  | { kind: "components"; componentIds: number[] }
  | {
      kind: "componentImpacts";
      impacts: readonly { pageComponentId: number; impact: string }[];
    };

export type SummaryLine = {
  label: string;
  value: string;
  ref?: SummaryLineRef;
};

export type ApprovalMeta<TInput> = {
  /**
   * Tuple — capped at one flag. Multi-flag UX deserves a modal, not 2^N
   * buttons. The registry validates the cap at module load.
   */
  extraFlags?: [ExtraFlag];
  /**
   * Required whenever `extraFlags` is declared. Returns a new input with
   * the flag value merged in — must not mutate the input.
   */
  applyFlags?: (input: TInput, flags: Record<string, boolean>) => TInput;
  /**
   * Optional async enrichment applied to the draft input before the
   * confirmation preview renders and the pending action is stored — so the
   * card reflects what `run` will actually persist (e.g. carried-forward
   * impacts). Surfaces that build a draft (Slack) call this; must not mutate.
   */
  prepareDraftInput?: (args: {
    ctx: ServiceContext;
    input: TInput;
  }) => Promise<TInput>;
  /** Surface-rendered confirmation summary. */
  summarize: (input: TInput) => { title: string; lines: SummaryLine[] };
  /**
   * Past-tense verb for the default presenter ("created", "resolved").
   * Inferred from the tool name when omitted.
   */
  verb?: string;
};

export type InferAgentToolInput<T> =
  T extends AgentTool<infer I, unknown> ? I : never;
export type InferAgentToolOutput<T> =
  T extends AgentTool<unknown, infer O> ? O : never;

// `any` is the variance escape hatch — `unknown` would block storing
// concrete tools because function inputs are contravariant.
// oxlint-disable-next-line typescript/no-explicit-any -- registry-level variance escape hatch
export type AnyAgentTool = AgentTool<any, any>;

export type AgentToolRegistry = Record<string, AnyAgentTool>;

export type { z };
