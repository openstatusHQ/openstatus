import type { Workspace } from "@openstatus/db/src/schema/workspaces/validation";
import type { ServiceContext } from "@openstatus/services";
import { generateText, stepCountIs } from "ai";
import type { ModelMessage } from "ai";

import { buildSlackTools } from "./registry-runner";

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

export function buildSystemPrompt(workspaceName: string): string {
  // Intentional: a per-call ISO timestamp defeats Anthropic/Gateway
  // prompt caching, but the agent needs minute-level precision to parse
  // relative times like "next Friday from 2-3 PM". Slack agent volume is
  // low; the latency/cost trade is acceptable. If this ever becomes hot,
  // move the timestamp to the first user message so the rest of the
  // system prompt can cache.
  const now = new Date().toISOString();
  return `You are the OpenStatus assistant for workspace "${workspaceName}".
The current date and time is: ${now} (UTC).
You help teams create and manage status reports and maintenance windows through Slack.

IMPORTANT: You have NO knowledge of this workspace's data. NEVER guess or make up IDs (page IDs, component IDs, report IDs). You MUST call the appropriate tool first to get real data.
- Questions about pages or components -> call list_status_pages FIRST
- Questions about reports -> call list_status_reports FIRST
- Questions about maintenances -> call list_maintenances FIRST
- Creating a report -> you MUST call list_status_pages first to get the real pageId, then call create_status_report with that pageId
- Scheduling maintenance -> you MUST call list_status_pages first to get the real pageId, then call create_maintenance with that pageId
- Components live on a specific page — call list_page_components({ pageId }) to discover pageComponentIds.
- NEVER pass a pageId you did not receive from list_status_pages. Guessing a pageId WILL cause an error.

Capabilities:
- Create status reports on status pages (create_status_report)
- Publish progress updates to existing reports (add_status_report_update)
- Edit report metadata like title or components (update_status_report)
- Resolve active reports (resolve_status_report)
- List active status reports and status pages
- Schedule maintenance windows (create_maintenance)
- List upcoming maintenance windows (list_maintenances)

Lifecycle: create_status_report once -> add_status_report_update repeatedly -> resolve_status_report.
- "provide an update", "we found the cause" -> add_status_report_update
- "it's fixed", "resolve it" -> resolve_status_report
- "rename the report", "add a component" -> update_status_report (metadata only)

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
