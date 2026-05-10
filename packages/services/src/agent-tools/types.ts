import type { Scope } from "@openstatus/db/src/schema";
import type { ZodType, z } from "zod";

import type { ServiceContext } from "../context";

/**
 * Framework-agnostic tool descriptor shared by the MCP adapter and the
 * dashboard chat AI SDK adapter. A registry-level type means descriptions
 * and schemas have a single source of truth — adding `monitor.list` once
 * surfaces it on both transports without duplicate wiring.
 *
 * Conventions:
 *  - `description` is factual (what the tool does + side-effects + the
 *    "do not guess" notes). Behavioral rubrics ("draft → ask → confirm")
 *    live in the system prompt, not in tool descriptions, so per-surface
 *    prompts can vary the wording without forking the descriptor.
 *  - `inputSchema` / `outputSchema` are Zod object schemas; both the MCP
 *    SDK and the AI SDK accept them directly.
 *  - `destructive` is the dashboard HITL hint (omit `execute` so the SDK
 *    pauses for confirmation). The MCP adapter mirrors it onto the
 *    `destructiveHint` annotation for clients.
 *  - `run` returns plain JS objects (not MCP `CallToolResult`); the MCP
 *    adapter wraps the return value so error semantics stay consistent.
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

// `any` (not `unknown`) is load-bearing here: the registry stores
// tools with diverse I/O types and adapters call `run({ input })`
// with values whose type isn't known at the registry boundary.
// `AgentTool<unknown, unknown>` would forbid storing a concrete
// `AgentTool<{ title: string }, …>` because function inputs are
// contravariant; `any` is the standard escape hatch for this
// covariance gap.
// biome-ignore lint/suspicious/noExplicitAny: registry-level variance escape hatch
export type AnyAgentTool = AgentTool<any, any>;

export type AgentToolRegistry = Record<string, AnyAgentTool>;

// Re-exported so tool authors can write `z.infer<typeof tool.inputSchema>`
// without importing Zod's runtime type alongside.
export type { z };
