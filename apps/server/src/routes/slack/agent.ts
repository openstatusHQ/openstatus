import type { Workspace } from "@openstatus/db/src/schema/workspaces/validation";
import type { ServiceContext } from "@openstatus/services";
import { generateText, stepCountIs } from "ai";
import type { ModelMessage } from "ai";

import { buildSlackTools } from "./registry-runner";
import { buildSystemPrompt } from "./system-prompt";

// Vercel AI Gateway model id. Override via SLACK_AGENT_MODEL when rolling
// out a new Sonnet version. Dotted format (`4.6`, not `4-6`) is what the
// gateway accepts — see `apps/dashboard/src/app/api/chat/route.ts`.
const DEFAULT_MODEL = "anthropic/claude-sonnet-4.6";
// `||` (not `??`) so empty / whitespace-only env values fall back to the
// default rather than being passed through to `generateText`.
const MODEL = process.env.SLACK_AGENT_MODEL?.trim() || DEFAULT_MODEL;

interface SlackThreadMessage {
  user?: string;
  bot_id?: string;
  text?: string;
}

interface AgentResult {
  text: string;
  toolResults: Array<{ toolName: string; result: unknown }>;
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
): Promise<AgentResult> {
  const ctx: ServiceContext = {
    workspace,
    actor: {
      type: "slack",
      teamId: origin?.teamId ?? "",
      slackUserId: origin?.slackUserId ?? "",
    },
  };
  const tools = buildSlackTools(ctx);
  let messages = convertThreadToMessages(thread, botUserId);

  if (messages.length === 0 && userText) {
    messages = [{ role: "user" as const, content: userText }];
  }

  if (messages.length === 0) {
    return {
      text: "I couldn't read your message. Please try again.",
      toolResults: [],
    };
  }

  const result = await generateText({
    model: MODEL,
    system: buildSystemPrompt(workspace.name ?? "Unknown"),
    messages,
    tools,
    stopWhen: stepCountIs(5),
  });

  const toolResults: AgentResult["toolResults"] = [];
  for (const step of result.steps) {
    for (const tc of step.toolResults) {
      toolResults.push({ toolName: tc.toolName, result: tc.output });
    }
  }

  return { text: result.text, toolResults };
}
