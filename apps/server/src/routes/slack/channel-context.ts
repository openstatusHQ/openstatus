import { getLogger } from "@logtape/logtape";
import type { WebClient } from "@slack/web-api";
import { type Tool, tool } from "ai";
import { z } from "zod";

import { redis } from "@/libs/clients";

const logger = getLogger("api-server");

/**
 * The channel the user is looking at, as reported by `app_context_changed`.
 *
 * Short-lived on purpose: it is a fact about right now, and acting on a
 * channel someone glanced at half an hour ago would be worse than having no
 * context at all.
 */
const CONTEXT_PREFIX = "slack:context:";
const CONTEXT_TTL_SECONDS = 15 * 60;

function contextKey(teamId: string, userId: string): string {
  return `${CONTEXT_PREFIX}${teamId}:${userId}`;
}

export async function rememberContext(
  teamId: string,
  userId: string,
  channelId: string,
): Promise<void> {
  await redis.set(contextKey(teamId, userId), channelId, {
    ex: CONTEXT_TTL_SECONDS,
  });
}

export async function forgetContext(
  teamId: string,
  userId: string,
): Promise<void> {
  await redis.del(contextKey(teamId, userId));
}

export async function recallContext(
  teamId: string,
  userId: string,
): Promise<string | undefined> {
  return (await redis.get<string>(contextKey(teamId, userId))) ?? undefined;
}

/** The event carries no `user`; the authorizing human is in `authorizations`. */
export function contextUserId(
  authorizations: Array<{ user_id?: string; is_bot?: boolean }> | undefined,
): string | undefined {
  if (!authorizations?.length) return undefined;
  const human = authorizations.find((a) => a.is_bot === false && a.user_id);
  return (human ?? authorizations.find((a) => a.user_id))?.user_id;
}

/**
 * The channel out of a context payload. Entities come ordered by relevance,
 * so the first channel is the one being looked at.
 */
export function contextChannelId(
  entities: Array<{ type?: string; value?: string }> | undefined,
): string | undefined {
  return entities?.find((e) => e.type?.endsWith("channel_id") && e.value)
    ?.value;
}

const MAX_CONTEXT_MESSAGES = 50;

const readChannelInput = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_CONTEXT_MESSAGES)
    .optional()
    .describe("How many recent messages to read. Defaults to 50."),
});

/**
 * The tool and the prompt note that let the agent use what the user is
 * currently looking at.
 *
 * The model is told about the channel but has to ask for it: reading is
 * authorized by the user's request, not by them having the channel on screen.
 * `<#C…>` renders as the channel's name client-side, which is why no
 * `conversations.info` call (and no `channels:read` scope) is needed here.
 */
export function channelContextTooling(args: {
  slack: WebClient;
  channelId: string;
}): { tools: Record<string, Tool>; contextNote: string } {
  const { slack, channelId } = args;

  const readChannel = tool({
    description:
      "Read the recent messages of the Slack channel the user is currently viewing, so you can summarize the incident discussed there. Only call this when the user's request refers to that conversation.",
    inputSchema: readChannelInput,
    execute: async ({ limit }) => {
      try {
        const res = await slack.conversations.history({
          channel: channelId,
          limit: limit ?? MAX_CONTEXT_MESSAGES,
        });
        const messages = (res.messages ?? [])
          .map((m) => ({
            user: m.user ?? m.bot_id ?? "unknown",
            text: m.text ?? "",
            ts: m.ts ?? "",
          }))
          .filter((m) => m.text)
          // Slack returns newest first; the discussion reads forwards.
          .reverse();
        return { channelId, messages };
      } catch (err) {
        const error = errorCode(err);
        logger.info("slack could not read the context channel", {
          error,
          channelId,
        });
        // Handed back as data so the model can explain it, rather than thrown
        // — a channel the bot isn't in is an ordinary outcome here, not a bug.
        return { channelId, error };
      }
    },
  });

  return {
    tools: { read_slack_channel: readChannel },
    contextNote: `
Slack context:
- The user is currently looking at the Slack channel <#${channelId}>.
- read_slack_channel reads that channel's recent messages. Call it when the request refers to that conversation ("draft an update for this", "what's happening here?", "summarize this incident").
- Do NOT call it for unrelated questions, and never repeat its contents unprompted. The user's request is what authorizes reading it.
- If it returns \`error: "not_in_channel"\`, say you aren't in <#${channelId}> and ask them to run \`/invite @openstatus\` there. Do not guess at the incident from anything else.`,
  };
}

function errorCode(err: unknown): string {
  const data = (err as { data?: { error?: unknown } })?.data;
  return typeof data?.error === "string" ? data.error : "unknown_error";
}
