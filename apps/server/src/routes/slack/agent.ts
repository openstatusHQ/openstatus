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
You help teams create and manage status reports through Slack.

IMPORTANT: You have NO knowledge of this workspace's data. NEVER guess or make up status pages, components, or reports. ALWAYS call the appropriate tool first to get real data.
- Questions about pages or components -> call listStatusPages
- Questions about reports -> call listStatusReports
- Creating a report -> call listStatusPages first, then createStatusReport

Capabilities:
- Create status reports on status pages (createStatusReport)
- Publish progress updates to existing reports (addStatusReportUpdate)
- Edit report metadata like title or components (updateStatusReport)
- List active status reports and status pages

Lifecycle: createStatusReport once -> addStatusReportUpdate repeatedly -> resolved.
- "provide an update", "we found the cause", "resolve it" -> addStatusReportUpdate
- "rename the report", "add a component" -> updateStatusReport (metadata only)

Guidelines:
- If multiple status pages exist, ask which one to use. If only one, use it automatically.
- Infer the status from conversation context:
  "we have an incident" -> investigating
  "we found the root cause" -> identified
  "we're watching it" -> monitoring
  "it's fixed" -> resolved
- Draft professional status page updates. Don't repeat the user verbatim.
- When tagged in a thread, synthesize the full thread into a status report draft.
- Status progression: investigating -> identified -> monitoring -> resolved
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
    model: "anthropic/claude-sonnet-4.5",
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
