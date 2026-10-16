import type { ModelMessage } from "ai";

export interface SlackThreadMessage {
  user?: string;
  bot_id?: string;
  text?: string;
  ts?: string;
}

export function slackTsToDate(ts: string): Date | undefined {
  const seconds = Number(ts);
  return Number.isFinite(seconds) && seconds > 0
    ? new Date(seconds * 1000)
    : undefined;
}

export function formatSlackTime(ts: string | undefined): string | undefined {
  const date = ts ? slackTsToDate(ts) : undefined;
  if (!date) return undefined;
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export function formatSlackLine(msg: SlackThreadMessage): string {
  const time = formatSlackTime(msg.ts);
  const author = msg.user ? `<@${msg.user}>` : (msg.bot_id ?? "unknown");
  return `${time ? `[${time}] ` : ""}${author}: ${msg.text ?? ""}`;
}

export function convertThreadToMessages(
  thread: SlackThreadMessage[],
  botUserId: string,
): ModelMessage[] {
  const messages: ModelMessage[] = [];
  for (const msg of thread) {
    if (!msg.text) continue;
    // Other apps' bots carry a `bot_id` too: only our own user is the agent.
    if (msg.user === botUserId) {
      messages.push({ role: "assistant", content: msg.text });
    } else {
      messages.push({ role: "user", content: formatSlackLine(msg) });
    }
  }
  // The API requires the first message to have role "user".
  while (messages.length > 0 && messages[0].role !== "user") {
    messages.shift();
  }
  return messages;
}
