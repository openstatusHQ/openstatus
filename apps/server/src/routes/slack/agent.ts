import type { Workspace } from "@openstatus/db/src/schema/workspaces/validation";
import type { ServiceContext } from "@openstatus/services";
import { stepCountIs, streamText } from "ai";
import type { ModelMessage, Tool } from "ai";

import { tb } from "@/libs/clients";

import { buildSlackTools } from "./registry-runner";
import { buildSystemPrompt } from "./system-prompt";

// Vercel AI Gateway model id (`anthropic/<model>`). Override via
// SLACK_AGENT_MODEL when rolling out a new model version.
const DEFAULT_MODEL = "anthropic/claude-opus-5";
// `||` (not `??`) so empty / whitespace-only env values fall back to the
// default rather than being passed through to `generateText`.
const MODEL = process.env.SLACK_AGENT_MODEL?.trim() || DEFAULT_MODEL;

interface SlackThreadMessage {
  user?: string;
  bot_id?: string;
  text?: string;
}

// A mention needs list_status_pages + list_page_components before it can draft,
// and the model is told to check monitor status first — 5 left no headroom.
const MAX_STEPS = 10;

interface AgentResult {
  text: string;
  toolResults: Array<{ toolName: string; result: unknown }>;
  finishReason: string;
  stepCount: number;
  /** True when the model used every allowed step — a draft may have been cut off. */
  hitStepLimit: boolean;
  /** True when the user stopped the turn; `text` is then whatever was written. */
  aborted: boolean;
}

/**
 * Progress reported as the turn runs, so the surface can show the answer
 * arriving and the tools being used rather than a spinner. Every callback is
 * awaited inside the stream loop: a slow one slows the turn, and a throwing
 * one aborts it, so implementations swallow their own failures.
 */
export interface AgentEvents {
  onTextDelta(delta: string): Promise<void>;
  onToolCall(call: { id: string; toolName: string }): Promise<void>;
  onToolResult(result: { id: string; toolName: string }): Promise<void>;
}

export interface AgentOptions {
  events?: AgentEvents;
  /** Aborted when the user presses Slack's stop button. */
  signal?: AbortSignal;
  /** Surface-only tools, merged over the registry's. */
  tools?: Record<string, Tool>;
  /** Appended to the system prompt: what the user is looking at right now. */
  contextNote?: string;
}

function convertThreadToMessages(
  thread: SlackThreadMessage[],
  botUserId: string,
): ModelMessage[] {
  const messages: ModelMessage[] = [];
  for (const msg of thread) {
    if (!msg.text) continue;
    if (msg.bot_id || msg.user === botUserId) {
      messages.push({ role: "assistant", content: msg.text });
    } else {
      messages.push({ role: "user", content: msg.text });
    }
  }
  // The API requires the first message to have role "user".
  // Drop any leading assistant messages (e.g. bot confirmations from a prior turn).
  while (messages.length > 0 && messages[0].role !== "user") {
    messages.shift();
  }
  return messages;
}

export async function runAgent(
  workspace: Workspace,
  thread: SlackThreadMessage[],
  botUserId: string,
  userText?: string,
  origin?: { slackUserId: string; teamId: string | undefined },
  options?: AgentOptions,
): Promise<AgentResult> {
  const ctx: ServiceContext = {
    workspace,
    actor: {
      type: "slack",
      teamId: origin?.teamId ?? "",
      slackUserId: origin?.slackUserId ?? "",
    },
    tb,
  };
  const tools = buildSlackTools(ctx, options?.tools);
  let messages = convertThreadToMessages(thread, botUserId);

  if (messages.length === 0 && userText) {
    messages = [{ role: "user" as const, content: userText }];
  }

  if (messages.length === 0) {
    return {
      text: "I couldn't read your message. Please try again.",
      toolResults: [],
      finishReason: "unknown",
      stepCount: 0,
      hitStepLimit: false,
      aborted: false,
    };
  }

  const { events, signal, contextNote } = options ?? {};

  const result = streamText({
    model: MODEL,
    system: buildSystemPrompt(workspace.name ?? "Unknown", contextNote),
    messages,
    tools,
    stopWhen: stepCountIs(MAX_STEPS),
    abortSignal: signal,
  });

  // The text is accumulated here rather than read from `result.text` at the
  // end, because a stopped turn has no end to wait for — this is what the
  // user was shown before they stopped it.
  let text = "";
  let aborted = false;

  // `fullStream` has to be drained for the turn to run to completion, whether
  // or not anyone is listening. A model error surfaces when the settled
  // promises below are awaited, so it still reaches the caller's catch.
  try {
    for await (const part of result.fullStream) {
      if (signal?.aborted) {
        aborted = true;
        break;
      }
      switch (part.type) {
        case "text-delta":
          text += part.text;
          await events?.onTextDelta(part.text);
          break;
        case "tool-call":
          await events?.onToolCall({
            id: part.toolCallId,
            toolName: part.toolName,
          });
          break;
        // A failed tool still has a task on the Slack timeline; without this it
        // stays "in progress" for the rest of the thread's life.
        case "tool-result":
        case "tool-error":
          await events?.onToolResult({
            id: part.toolCallId,
            toolName: part.toolName,
          });
          break;
        case "abort":
          aborted = true;
          break;
        default:
          break;
      }
      if (aborted) break;
    }
  } catch (err) {
    // An abort surfaces as a rejection in some providers and as an `abort`
    // part in others. Anything else is a real failure.
    if (!signal?.aborted) throw err;
    aborted = true;
  }

  const stoppedResult = (): AgentResult => ({
    text,
    toolResults: [],
    finishReason: "abort",
    stepCount: 0,
    hitStepLimit: false,
    aborted: true,
  });

  if (aborted) return stoppedResult();

  const steps = await result.steps;
  const toolResults: AgentResult["toolResults"] = [];
  for (const step of steps) {
    for (const tc of step.toolResults) {
      toolResults.push({ toolName: tc.toolName, result: tc.output });
    }
  }

  // Rechecked here: a stop arriving while the promises above settle would
  // otherwise deliver an answer Slack has already stopped the turn on.
  if (signal?.aborted) return stoppedResult();

  return {
    text: await result.text,
    toolResults,
    finishReason: await result.finishReason,
    stepCount: steps.length,
    hitStepLimit: steps.length >= MAX_STEPS,
    aborted: false,
  };
}
