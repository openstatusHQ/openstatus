import type { Scope } from "@openstatus/db/src/schema";
import type { ZodType, z } from "zod";

import type { ServiceContext } from "../context";

/**
 * Framework-agnostic tool descriptor shared by every adapter (MCP, AI SDK).
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
};

export type InferAgentToolInput<T> = T extends AgentTool<infer I, unknown>
  ? I
  : never;
export type InferAgentToolOutput<T> = T extends AgentTool<unknown, infer O>
  ? O
  : never;

// `any` is the variance escape hatch — `unknown` would block storing
// concrete tools because function inputs are contravariant.
// biome-ignore lint/suspicious/noExplicitAny: registry-level variance escape hatch
export type AnyAgentTool = AgentTool<any, any>;

export type AgentToolRegistry = Record<string, AnyAgentTool>;

export type { z };
