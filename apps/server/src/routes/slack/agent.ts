import type { Workspace } from "@openstatus/db/src/schema/workspaces/validation";
import { generateText, stepCountIs } from "ai";
import type { ModelMessage } from "ai";
import { type Message, type Thread, toAiMessages } from "chat";
import { createTools } from "./tools";

export interface AgentResult {
  text: string;
  toolResults: Array<{ toolName: string; result: unknown }>;
}

export function buildSystemPrompt(workspaceName: string): string {
  const now = new Date().toISOString();
  return `You are the OpenStatus assistant for workspace "${workspaceName}".
The current date and time is: ${now} (UTC).
You help teams create and manage status reports and maintenance windows through Slack.

IMPORTANT: You have NO knowledge of this workspace's data. NEVER guess or make up IDs (page IDs, component IDs, report IDs). You MUST call the appropriate tool first to get real data.
- Questions about pages or components -> call listStatusPages FIRST
- Questions about reports -> call listStatusReports FIRST
- Questions about maintenances -> call listMaintenances FIRST
- Creating a report -> you MUST call listStatusPages first to get the real pageId, then call createStatusReport with that pageId
- Scheduling maintenance -> you MUST call listStatusPages first to get the real pageId, then call createMaintenance with that pageId
- NEVER pass a pageId you did not receive from listStatusPages. Guessing a pageId WILL cause an error.

Capabilities:
- Create status reports on status pages (createStatusReport)
- Publish progress updates to existing reports (addStatusReportUpdate)
- Edit report metadata like title or components (updateStatusReport)
- List active status reports and status pages
- Schedule maintenance windows (createMaintenance)
- List upcoming maintenance windows (listMaintenances)

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
- For any mutation, always call the tool so the user sees a confirmation.

Maintenance scheduling:
- Parse natural language dates into ISO 8601 format. Convert relative dates like "next Friday from 2-3 PM" into proper ISO 8601 timestamps.
- If the user doesn't specify a timezone, default to UTC and mention that in your response.
- The "from" time must be before the "to" time.
- Write a professional maintenance message describing what will happen during the window.`;
}

async function collectMessages(thread: Thread, limit: number): Promise<Message[]> {
  const msgs: Message[] = [];
  for await (const msg of thread.messages) {
    msgs.push(msg);
    if (msgs.length >= limit) break;
  }
  msgs.reverse();
  return msgs;
}

export async function runAgentFromThread(
  workspace: Workspace,
  thread: Thread,
  message: Message,
): Promise<AgentResult> {
  const tools = createTools(workspace);
  const history = await collectMessages(thread, 100);
  let messages = await toAiMessages(history);

  // The API requires the first message to have role "user".
  while (messages.length > 0 && messages[0].role !== "user") {
    messages.shift();
  }

  if (messages.length === 0 && message.text) {
    messages = [{ role: "user" as const, content: message.text }];
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
    messages: messages as ModelMessage[],
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
