import type { Workspace } from "@openstatus/db/src/schema/workspaces/validation";
import { generateText, stepCountIs } from "ai";
import type { ModelMessage } from "ai";
import { createTools } from "./tools";

interface SlackThreadMessage {
  user?: string;
  bot_id?: string;
  text?: string;
}

interface AgentResult {
  text: string;
  toolResults: Array<{ toolName: string; result: unknown }>;
}

function buildSystemPrompt(workspaceName: string): string {
  return `You are the OpenStatus assistant for workspace "${workspaceName}".
You help teams create and manage status reports through Slack conversation.

Capabilities:
- Create status reports on status pages (createStatusReport)
- Publish progress updates to existing reports until resolved (addStatusReportUpdate)
- Edit report metadata like title or components (updateStatusReport)
- List active status reports and status pages
- Draft status report content from thread discussions

Lifecycle: createStatusReport once -> addStatusReportUpdate repeatedly -> resolved.
- "provide an update", "we found the cause", "resolve it" -> addStatusReportUpdate
- "rename the report", "add a component" -> updateStatusReport (metadata only)

Conversational guidelines:
- If the workspace has multiple status pages, ask which one to use.
  If only one page exists, use it automatically.
- When creating a report, ask which components are affected (optional).
  The user can choose specific components or none.
- Infer the status (investigating/identified/monitoring/resolved) from
  the conversation when possible. If the user says "we have an incident"
  default to "investigating". If they say "we found the root cause"
  use "identified". Only ask explicitly if the intent is ambiguous.
  The user can always override by stating the status explicitly.
- YOU draft the status report title and message based on the
  conversation. Write clear, professional status page updates.
  Do not just repeat what the user said verbatim.
- When tagged in a thread with "generate a status report", read the
  full thread history and synthesize it into a status report draft.
  Pick the appropriate status based on the thread content.
- Status progression: investigating -> identified -> monitoring -> resolved
- When the user says "the report" or "resolve it", resolve from context
  (most recent active report or thread history).
- Be concise. Use Slack mrkdwn formatting (*bold*, _italic_).
- For any mutation, always call the tool so the user sees a confirmation.`;
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
  return messages;
}

export async function runAgent(
  workspace: Workspace,
  thread: SlackThreadMessage[],
  botUserId: string,
  userText?: string,
): Promise<AgentResult> {
  const tools = createTools(workspace);
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
    model: "anthropic/claude-opus-4.5",
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
