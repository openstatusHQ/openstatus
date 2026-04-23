import { env } from "@/env";
import { createSlackAdapter } from "@chat-adapter/slack";
import { createIoRedisState } from "@chat-adapter/state-ioredis";
import { Chat, ConsoleLogger, type Message } from "chat";
import { type SlackWorkspace, resolveWorkspace } from "./workspace-resolver";

const logger = new ConsoleLogger("info");

export const slackAdapter = createSlackAdapter({
  clientId: env.SLACK_CLIENT_ID,
  clientSecret: env.SLACK_CLIENT_SECRET,
});

export const bot = new Chat({
  userName: "openstatus",
  adapters: { slack: slackAdapter },
  state: createIoRedisState({ url: env.REDIS_URL || "", logger }),
  dedupeTtlMs: 300_000,
});

export function parseThreadTs(threadId: string): string {
  const parts = threadId.split(":");
  return parts.length >= 3 ? parts.slice(2).join(":") : threadId;
}

export async function resolveWorkspaceFromMessage(
  message: Message,
): Promise<SlackWorkspace | null> {
  const raw = message.raw as { team_id?: string; team?: string };
  const teamId = raw.team_id ?? raw.team;
  if (!teamId) return null;
  return resolveWorkspace(teamId);
}
